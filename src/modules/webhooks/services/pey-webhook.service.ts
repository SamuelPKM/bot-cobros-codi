import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { paymentFromTransaction } from '../../charges/mappers/pey-payment.mapper';
import { ChargePaymentsService } from '../../charges/services/charge-payments.service';
import { PaymentNotifier } from '../../notifications/services/payment-notifier.service';
import {
  CODI_PAYMENT_EVENTS,
  PEY_SOURCE,
} from '../constants/webhooks.constants';
import { WebhookEvent } from '../entities/webhook-event.entity';
import type {
  PeyWebhookEvent,
  VerifiedWebhook,
  WebhookResult,
} from '../interfaces/pey-webhook-event.interface';

/**
 * Procesa los webhooks de pey de un negocio, con entrega "al menos una vez":
 *  - Se registra cada webhook-id (por negocio); uno ya procesado no se repite.
 *  - Si algo falla se lanza el error (el controlador responde 500) y el evento
 *    queda sin `processed_at`, para que el reintento de pey lo procese.
 *  - El webhook es solo el aviso; la API de pey es la fuente de verdad del pago,
 *    consultada con la API key del negocio.
 */
@Injectable()
export class PeyWebhookService {
  private readonly logger = new Logger(PeyWebhookService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly events: Repository<WebhookEvent>,
    private readonly businesses: BusinessesService,
    private readonly payments: ChargePaymentsService,
    private readonly notifier: PaymentNotifier,
  ) {}

  async handle(
    businessId: number,
    { id, event }: VerifiedWebhook,
  ): Promise<WebhookResult> {
    const source = `${PEY_SOURCE}:${businessId}`;
    await this.events
      .createQueryBuilder()
      .insert()
      .values({ source, id, type: event.type ?? null })
      .orIgnore()
      .execute();
    const recorded = await this.events.findOneByOrFail({ source, id });
    if (recorded.processedAt) {
      this.logger.log(
        `${source} ${id} repetido, ya procesado (${recorded.result})`,
      );
      return 'duplicate';
    }

    const kind = event.type ? CODI_PAYMENT_EVENTS[event.type] : undefined;
    const result = kind
      ? await this.processPayment(businessId, event, kind)
      : 'ignored';

    await this.events.update(
      { source, id },
      { processedAt: new Date(), result },
    );
    this.logger.log(`${source} ${id} ${event.type ?? 'sin tipo'} -> ${result}`);
    return result;
  }

  private async processPayment(
    businessId: number,
    event: PeyWebhookEvent,
    kind: 'push' | 'qr',
  ): Promise<WebhookResult> {
    if (!event.transactionId) return 'missing_transaction_id';

    const pey = await this.businesses.peyFor(businessId);
    const tx = await pey.getTransaction(event.transactionId);
    if (tx.status !== 'PAID') {
      throw new Error(
        `la transacción ${event.transactionId} está en ${tx.status}, no en PAID`,
      );
    }

    const payment = paymentFromTransaction(tx, kind, {
      businessId,
      qrId: event.codiQrId,
      fallback: {
        chargeId: event.metadata?.externalMetadata?.chargeId,
        datePaid: event.datePaid,
        trackingKey: event.metadata?.trackingKey,
      },
    });
    const { result, chargeId: paidChargeId } =
      await this.payments.recordPayment({
        ...payment,
        transactionId: event.transactionId,
      });
    if (result === 'paid' && paidChargeId !== null)
      await this.notify(paidChargeId);
    return result;
  }

  /** El pago ya quedó registrado: si el aviso falla no se le pide a pey que reintente; lo reintenta el barrido. */
  private async notify(chargeId: number): Promise<void> {
    try {
      await this.notifier.notifyPaid(chargeId);
    } catch (error) {
      this.logger.warn(
        `cobro ${chargeId}: el aviso de pago falló, lo reintentará el barrido: ${(error as Error).message}`,
      );
    }
  }
}
