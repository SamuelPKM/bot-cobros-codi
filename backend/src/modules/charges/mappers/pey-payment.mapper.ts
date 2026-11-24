import { pesosToCents } from '../../../shared/money/money';
import type {
  PeyPaymentLink,
  PeyTransaction,
} from '../../pey/interfaces/pey-codi.interface';
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

/**
 * Traduce una liga PAID de pey al pago que registra charges. Suma la base de
 * todos sus pagos (sin propina ni comisión). El cobro se reconoce por el id de
 * la liga o, de respaldo, por `clientReferenceId` ("cobro-<id>").
 */
export function paymentFromLink(
  link: PeyPaymentLink,
  { businessId }: { businessId: number },
): RecordPaymentInput {
  const paidCents = link.transactions.reduce(
    (sum, tx) => sum + pesosToCents(tx.amountBreakdown?.base ?? tx.amount),
    0,
  );
  const last = link.transactions.at(-1);
  const reference = /^cobro-(\d+)$/.exec(link.clientReferenceId ?? '');
  return {
    businessId,
    kind: 'link',
    transactionId: last?.transactionId ?? `link-${link.id}`,
    linkId: link.id,
    chargeId: reference ? Number(reference[1]) : undefined,
    paidCents,
    paidAt: last?.datePaid ? new Date(last.datePaid * 1000) : new Date(),
    trackingKey: last?.metadata?.trackingKey ?? null,
  };
}
