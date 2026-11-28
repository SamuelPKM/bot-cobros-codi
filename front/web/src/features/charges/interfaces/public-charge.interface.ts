import type { AttemptKind, AttemptStatus, ChargeStatus } from '../types/charge.types';

/** Respuestas de /charges de la API. Montos en pesos y fechas ISO 8601. */
export interface PublicAttempt {
  id: number;
  kind: AttemptKind;
  status: AttemptStatus;
  expiresAt: string | null;
  /** Motivo para quien cobra cuando falló o quedó en duda. */
  error: string | null;
  qrString: string | null;
  linkUrl: string | null;
}

export interface PublicCharge {
  id: number;
  status: ChargeStatus;
  /** Total cobrado: cobro + propina. */
  amount: number;
  /** Cobro sin propina. */
  subtotal: number;
  /** Propina; 0 si no hubo. */
  tip: number;
  concept: string | null;
  payerPhone: string | null;
  seller: { id: number; name: string };
  paidVia: AttemptKind | null;
  paidAt: string | null;
  createdAt: string;
  attempts: PublicAttempt[];
}
