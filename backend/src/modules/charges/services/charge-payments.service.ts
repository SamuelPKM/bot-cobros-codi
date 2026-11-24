import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Charge } from '../entities/charge.entity';
import { PaymentAttempt } from '../entities/payment-attempt.entity';
import type {
  RecordPaymentInput,
  RecordPaymentOutcome,
} from '../interfaces/record-payment.interface';

/**
 * Registra pagos confirmados. Es idempotente: el mismo pago avisado varias
 * veces deja el cobro igual. Se apoya en el lock del cobro para que dos avisos
 * simultáneos (push y QR) no lo marquen pagado dos veces.
 */
@Injectable()
export class ChargePaymentsService {
  private readonly logger = new Logger(ChargePaymentsService.name);

  constructor(private readonly dataSource: DataSource) {}

  recordPayment(input: RecordPaymentInput): Promise<RecordPaymentOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const attempt = await this.findAttempt(manager, input);
      if (!attempt) {
        this.logger.warn(
          `pago de un cobro que no conocemos: ${input.transactionId}`,
        );
        return { result: 'unknown_charge', chargeId: null };
      }

      const charge = await manager.findOneOrFail(Charge, {
        where: { id: attempt.chargeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (input.paidCents !== charge.amountCents) {
        this.logger.warn(
          `cobro ${charge.id}: se cobró ${charge.amountCents} y se pagó ${input.paidCents} (centavos); no se marca`,
        );
        return { result: 'amount_mismatch', chargeId: charge.id };
      }

      // Un mismo QR puede recibir más de un pago: el segundo es un pago de más.
      const otherTransaction =
        attempt.transactionId !== null &&
        attempt.transactionId !== input.transactionId;

      await manager.update(PaymentAttempt, attempt.id, {
        status: 'paid',
        transactionId: attempt.transactionId ?? input.transactionId,
        trackingKey: attempt.trackingKey ?? input.trackingKey,
      });

      if (charge.status === 'paid') {
        if (charge.paidAttemptId === attempt.id && !otherTransaction) {
          return { result: 'already_paid', chargeId: charge.id };
        }
        this.logger.warn(
          `cobro ${charge.id}: ya estaba pagado y llegó otro pago (${input.transactionId}): revisar devolución`,
        );
        return { result: 'extra_payment', chargeId: charge.id };
      }

      // Se registra aunque el cobro haya expirado: el dinero sí llegó.
      await manager.update(Charge, charge.id, {
        status: 'paid',
        paidVia: attempt.kind,
        paidAttemptId: attempt.id,
        paidAt: input.paidAt,
      });
      return { result: 'paid', chargeId: charge.id };
    });
  }

  /**
   * Busca el intento por transactionId, luego por id del QR y, como respaldo,
   * por `metadata.chargeId` (cuando la respuesta de pey se perdió y el intento
   * quedó sin transactionId). Si el cobro existe pero no hay intento que
   * reclamar, registra uno nuevo para no perder el pago.
   */
  private async findAttempt(
    manager: EntityManager,
    input: RecordPaymentInput,
  ): Promise<PaymentAttempt | null> {
    // Cada búsqueda se limita a cobros del negocio que confirmó el pago.
    const ofBusiness = { charge: { businessId: input.businessId } };
    const byTransaction = await manager.findOne(PaymentAttempt, {
      where: { transactionId: input.transactionId, ...ofBusiness },
      relations: { charge: true },
    });
    if (byTransaction) return byTransaction;

    if (input.qrId) {
      const byQr = await manager.findOne(PaymentAttempt, {
        where: { qrId: input.qrId, ...ofBusiness },
        relations: { charge: true },
      });
      if (byQr) return byQr;
    }

    if (input.linkId) {
      const byLink = await manager.findOne(PaymentAttempt, {
        where: { linkId: input.linkId, ...ofBusiness },
        relations: { charge: true },
      });
      if (byLink) return byLink;
    }

    if (input.chargeId === undefined) return null;
    const charge = await manager.findOneBy(Charge, {
      id: input.chargeId,
      businessId: input.businessId,
    });
    if (!charge) return null;

    const unclaimed = await manager.findOne(PaymentAttempt, {
      where: { chargeId: charge.id, kind: input.kind, transactionId: IsNull() },
      order: { id: 'DESC' },
    });
    if (unclaimed) return unclaimed;

    return manager.save(
      manager.create(PaymentAttempt, {
        chargeId: charge.id,
        kind: input.kind,
        status: 'pending',
      }),
    );
  }
}
