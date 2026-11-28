import type { ChargeMethod, ChargeStatus } from '../types/charge.types';

export interface CreateChargeInput {
  /** push (al celular), qr o link. */
  method: ChargeMethod;
  /** 10 dígitos. Obligatorio para push; opcional para QR y liga. */
  payerPhone: string | null;
  /** Total que se cobra (cobro + propina). */
  amountCents: number;
  /** Propina incluida en `amountCents`; 0 si no hay. */
  tipCents?: number;
  concept: string | null;
}

export interface ListChargesFilter {
  /** Solo lo respeta el admin. */
  sellerId?: number;
  status?: ChargeStatus;
  limit: number;
}
