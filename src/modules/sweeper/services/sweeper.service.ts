import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DueAttempt } from '../../charges/interfaces/charge-expiry.interface';
import { paymentFromTransaction } from '../../charges/mappers/pey-payment.mapper';
import { ChargeLifecycleService } from '../../charges/services/charge-lifecycle.service';
import { ChargePaymentsService } from '../../charges/services/charge-payments.service';
import type { PeyTransaction } from '../../pey/interfaces/pey-codi.interface';
import { PeyClient } from '../../pey/services/pey-client.service';
import { PaymentNotifier } from '../../notifications/services/payment-notifier.service';
import { SWEEP_LOCK_KEY } from '../constants/sweeper.constants';

/**
 * Barrido periódico:
 *  1. Revisa con pey cada intento vencido: si sí se pagó (y el webhook se
 *     perdió) lo registra; si no, lo vence.
 *  2. Vence los cobros que llevan 30 minutos sin ningún intento vigente.
 *  3. Reintenta los avisos de pago que no se pudieron entregar.
 * Usa un advisory lock de Postgres para que dos barridos (o dos instancias)
 * nunca procesen lo mismo a la vez.
 */
@Injectable()
export class SweeperService {
  private readonly logger = new Logger(SweeperService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly pey: PeyClient,
    private readonly lifecycle: ChargeLifecycleService,
    private readonly payments: ChargePaymentsService,
    private readonly notifier: PaymentNotifier,
  ) {}

  async sweep(): Promise<void> {
    // El advisory lock es de sesión: se toma y se suelta en la misma conexión.
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const [{ locked }] = (await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [SWEEP_LOCK_KEY],
      )) as { locked: boolean }[];
      if (!locked) return;
      try {
        for (const attempt of await this.lifecycle.listDueAttempts()) {
          await this.reconcile(attempt);
        }
        const expired = await this.lifecycle.expireStaleCharges();
        if (expired > 0) this.logger.log(`${expired} cobro(s) vencido(s)`);
        await this.notifier.retryPending();
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [SWEEP_LOCK_KEY]);
      }
    } finally {
      await runner.release();
    }
  }

  /** Un error con pey deja el intento como estaba; el siguiente barrido lo reintenta. */
  private async reconcile(attempt: DueAttempt): Promise<void> {
    try {
      const tx = await this.findPayment(attempt);
      if (tx) {
        const { result } = await this.payments.recordPayment(
          paymentFromTransaction(tx, attempt.kind, { qrId: attempt.qrId }),
        );
        this.logger.log(
          `intento ${attempt.attemptId}: pago encontrado al vencer -> ${result}`,
        );
        return;
      }
      await this.lifecycle.expireAttempt(attempt.attemptId);
    } catch (error) {
      this.logger.warn(
        `intento ${attempt.attemptId}: no se pudo revisar con pey: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Pago de un intento según pey, o null. Un push en duda sin transactionId no
   * se puede consultar: se vence, y si luego llega el webhook se liga por chargeId.
   */
  private async findPayment(
    attempt: DueAttempt,
  ): Promise<PeyTransaction | null> {
    if (attempt.kind === 'qr' && attempt.qrId) {
      const payments = await this.pey.listQrTransactions(attempt.qrId);
      return payments.find((tx) => tx.status === 'PAID') ?? null;
    }
    if (attempt.transactionId) {
      const tx = await this.pey.getTransaction(attempt.transactionId);
      return tx.status === 'PAID' ? tx : null;
    }
    return null;
  }
}
