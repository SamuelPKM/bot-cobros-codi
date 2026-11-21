import type { AttemptKind } from '../types/charge.types';

/** Un intento vencido que hay que revisar con pey antes de darlo por perdido. */
export interface DueAttempt {
  attemptId: number;
  chargeId: number;
  /** Se revisa con la API key de este negocio. */
  businessId: number;
  kind: AttemptKind;
  transactionId: string | null;
  qrId: string | null;
  linkId: string | null;
}

/** Lo necesario para avisar de un pago. */
export interface PaidChargeNotice {
  chargeId: number;
  /** Solo se avisa a los admins de este negocio. */
  businessId: number;
  sellerId: number;
  sellerName: string;
  amountCents: number;
  /** null en cobros por QR o liga (no hay celular del cliente). */
  payerPhone: string | null;
  concept: string | null;
  /** Clave de rastreo SPEI del pago, si pey la dio. */
  trackingKey: string | null;
}
