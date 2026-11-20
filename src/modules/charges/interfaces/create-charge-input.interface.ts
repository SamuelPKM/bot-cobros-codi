import type { ChargeStatus } from '../types/charge.types';

export interface CreateChargeInput {
  /** 10 dígitos. */
  payerPhone: string;
  amountCents: number;
  concept: string | null;
}

export interface ListChargesFilter {
  /** Solo lo respeta el admin. */
  sellerId?: number;
  status?: ChargeStatus;
  limit: number;
}
