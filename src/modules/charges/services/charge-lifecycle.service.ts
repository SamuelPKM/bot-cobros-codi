import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CHARGE_TTL_MINUTES,
  EXPIRATION_GRACE_SECONDS,
} from '../constants/charges.constants';
import type {
  DueAttempt,
  PaidChargeNotice,
} from '../interfaces/charge-expiry.interface';

/**
 * Vencimientos y estado de avisos de los cobros. Lo usa el barrido; las
 * transiciones son condicionales para no pisar un pago que llegó a la par.
 */
@Injectable()
export class ChargeLifecycleService {
  constructor(private readonly dataSource: DataSource) {}

  /** Intentos vigentes cuyo plazo ya venció (con margen por si el webhook viene en camino). */
  async listDueAttempts(): Promise<DueAttempt[]> {
    const rows = await this.dataSource.query<
      {
        id: number;
        charge_id: number;
        business_id: number;
        kind: DueAttempt['kind'];
        transaction_id: string | null;
        qr_id: string | null;
      }[]
    >(
      `SELECT a.id, a.charge_id, c.business_id, a.kind, a.transaction_id, a.qr_id
         FROM payment_attempts a JOIN charges c ON c.id = a.charge_id
        WHERE a.status IN ('pending', 'unknown')
          AND a.expires_at <= now() - make_interval(secs => $1)
        ORDER BY a.id`,
      [EXPIRATION_GRACE_SECONDS],
    );
    return rows.map((r) => ({
      attemptId: r.id,
      chargeId: r.charge_id,
      businessId: r.business_id,
      kind: r.kind,
      transactionId: r.transaction_id,
      qrId: r.qr_id,
    }));
  }

  /** Vence el intento solo si sigue vigente. Devuelve true si lo cambió. */
  async expireAttempt(attemptId: number): Promise<boolean> {
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `UPDATE payment_attempts SET status = 'expired' WHERE id = $1 AND status IN ('pending', 'unknown')`,
      [attemptId],
    );
    return affected === 1;
  }

  /** Vence los cobros pendientes que llevan más de 30 minutos sin ningún intento vigente. */
  async expireStaleCharges(): Promise<number> {
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `UPDATE charges c SET status = 'expired'
        WHERE c.status = 'pending'
          AND c.created_at < now() - make_interval(mins => $1)
          AND NOT EXISTS (
            SELECT 1 FROM payment_attempts a
             WHERE a.charge_id = c.id
               AND a.status IN ('pending', 'unknown')
               AND a.expires_at > now())`,
      [CHARGE_TTL_MINUTES],
    );
    return affected;
  }

  /** Datos para avisar de un cobro pagado; null si no está pagado o ya se avisó. */
  async findPendingNotice(chargeId: number): Promise<PaidChargeNotice | null> {
    const notices = await this.queryNotices('AND c.id = $1', [chargeId]);
    return notices[0] ?? null;
  }

  /** Cobros pagados cuyo aviso no se pudo entregar. */
  listPendingNotices(): Promise<PaidChargeNotice[]> {
    return this.queryNotices('', []);
  }

  async markNotified(chargeId: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE charges SET notified_at = now() WHERE id = $1 AND notified_at IS NULL`,
      [chargeId],
    );
  }

  private async queryNotices(
    extra: string,
    params: unknown[],
  ): Promise<PaidChargeNotice[]> {
    const rows = await this.dataSource.query<
      {
        id: number;
        business_id: number;
        seller_id: number;
        name: string;
        amount_cents: number;
        concept: string | null;
      }[]
    >(
      `SELECT c.id, c.business_id, c.seller_id, u.name, c.amount_cents, c.concept
         FROM charges c JOIN users u ON u.id = c.seller_id
        WHERE c.status = 'paid' AND c.notified_at IS NULL ${extra}
        ORDER BY c.id`,
      params,
    );
    return rows.map((r) => ({
      chargeId: r.id,
      businessId: r.business_id,
      sellerId: r.seller_id,
      sellerName: r.name,
      amountCents: r.amount_cents,
      concept: r.concept,
    }));
  }
}
