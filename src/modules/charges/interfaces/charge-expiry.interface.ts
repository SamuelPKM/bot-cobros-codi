import type { AttemptKind } from '../types/charge.types';

/** Un intento vencido que hay que revisar con pey antes de darlo por perdido. */
export interface DueAttempt {
  attemptId: number;
  chargeId: number;
  kind: AttemptKind;
  transactionId: string | null;
  qrId: string | null;
}

/** Lo necesario para avisar de un pago. */
export interface PaidChargeNotice {
  chargeId: number;
  sellerId: number;
  sellerName: string;
  amountCents: number;
  concept: string | null;
}
