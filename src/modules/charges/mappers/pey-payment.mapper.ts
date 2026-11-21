import { pesosToCents } from '../../../shared/money/money';
import type { PeyTransaction } from '../../pey/interfaces/pey-codi.interface';
import type { RecordPaymentInput } from '../interfaces/record-payment.interface';
import type { AttemptKind } from '../types/charge.types';

/** Datos del aviso (webhook) para cuando la transacción no los trae. */
export interface PaymentFallback {
  chargeId?: unknown;
  datePaid?: number;
  trackingKey?: string;
}

/**
 * Traduce una transacción PAID de pey al pago que registra charges. Lo que
 * cuenta contra el cobro es la base (sin propina ni comisión).
 */
export function paymentFromTransaction(
  tx: PeyTransaction,
  kind: AttemptKind,
  {
    businessId,
    qrId,
    fallback = {},
  }: {
    /** Negocio con cuyas credenciales se confirmó la transacción. */
    businessId: number;
    qrId?: string | null;
    fallback?: PaymentFallback;
  },
): RecordPaymentInput {
  const chargeId = Number(
    tx.metadata?.externalMetadata?.chargeId ?? fallback.chargeId,
  );
  const datePaid = tx.datePaid ?? fallback.datePaid;
  return {
    businessId,
    kind,
    transactionId: tx.id,
    qrId: kind === 'qr' ? (qrId ?? undefined) : undefined,
    chargeId: Number.isInteger(chargeId) ? chargeId : undefined,
    paidCents: pesosToCents(tx.amountBreakdown?.base ?? tx.amount),
    paidAt: datePaid ? new Date(datePaid * 1000) : new Date(),
    trackingKey: tx.metadata?.trackingKey ?? fallback.trackingKey ?? null,
  };
}
