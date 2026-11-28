import type {
  AttemptKind,
  AttemptStatus,
  ChargeStatus,
} from '../types/charge.types';

export interface PublicAttempt {
  id: number;
  kind: AttemptKind;
  status: AttemptStatus;
  /** ISO 8601. */
  expiresAt: string | null;
  /** Motivo para el vendedor cuando falló o quedó en duda. */
  error: string | null;
  /** Solo en QR: contenido para dibujarlo tal cual. */
  qrString: string | null;
  /** Solo en liga: URL que se reenvía al cliente. */
  linkUrl: string | null;
}

/** Un cobro como lo ve la app. Montos en pesos. */
export interface PublicCharge {
  id: number;
  status: ChargeStatus;
  /** Total cobrado (cobro + propina). */
  amount: number;
  /** El cobro sin propina. */
  subtotal: number;
  /** Propina; 0 si no hubo. */
  tip: number;
  concept: string | null;
  /** null en cobros por QR o liga sin teléfono. */
  payerPhone: string | null;
  seller: { id: number; name: string };
  paidVia: AttemptKind | null;
  paidAt: string | null;
  createdAt: string;
  attempts: PublicAttempt[];
}

export interface PublicQr {
  qrString: string;
  expiresAt: string;
}

export interface PublicLink {
  url: string;
}
