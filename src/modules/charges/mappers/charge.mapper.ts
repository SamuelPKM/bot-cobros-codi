import { centsToPesos } from '../../../shared/money/money';
import type { Charge } from '../entities/charge.entity';
import type { PaymentAttempt } from '../entities/payment-attempt.entity';
import type {
  PublicAttempt,
  PublicCharge,
  PublicQr,
} from '../interfaces/public-charge.interface';

const iso = (date: Date | null): string | null =>
  date ? date.toISOString() : null;

export function toPublicAttempt(attempt: PaymentAttempt): PublicAttempt {
  return {
    id: attempt.id,
    kind: attempt.kind,
    status: attempt.status,
    expiresAt: iso(attempt.expiresAt),
    error: attempt.error,
    qrString: attempt.qrString,
  };
}

/** Requiere `seller` y `attempts` cargados. */
export function toPublicCharge(charge: Charge): PublicCharge {
  return {
    id: charge.id,
    status: charge.status,
    amount: centsToPesos(charge.amountCents),
    concept: charge.concept,
    payerPhone: charge.payerPhone,
    seller: { id: charge.sellerId, name: charge.seller?.name ?? '' },
    paidVia: charge.paidVia,
    paidAt: iso(charge.paidAt),
    createdAt: charge.createdAt.toISOString(),
    attempts: [...(charge.attempts ?? [])]
      .sort((a, b) => a.id - b.id)
      .map(toPublicAttempt),
  };
}

export function toPublicQr(attempt: PaymentAttempt): PublicQr {
  return {
    qrString: attempt.qrString!,
    expiresAt: attempt.expiresAt!.toISOString(),
  };
}
