import type { AttemptKind } from '../types/charge.types';

/** Un pago ya confirmado con la API de pey (status PAID). */
export interface RecordPaymentInput {
  /** Negocio cuyas credenciales confirmaron el pago: solo se liga a SUS cobros. */
  businessId: number;
  kind: AttemptKind;
  transactionId: string;
  /** Solo QR: IDC de Banxico. */
  qrId?: string;
  /** Respaldo: `metadata.chargeId` que mandamos a pey al crear el cobro. */
  chargeId?: number;
  /** Lo que pagó el cliente (sin propina ni comisión), en centavos. */
  paidCents: number;
  paidAt: Date;
  trackingKey: string | null;
}

/**
 * paid            primer pago del cobro: hay que avisar al vendedor.
 * already_paid    el mismo pago otra vez (pey reenvió el aviso).
 * extra_payment   el cobro ya estaba pagado por otro intento: hay que devolverlo.
 * amount_mismatch el monto pagado no es el del cobro: no se marca.
 * unknown_charge  el pago no corresponde a ningún cobro nuestro.
 */
export type RecordPaymentResult =
  | 'paid'
  | 'already_paid'
  | 'extra_payment'
  | 'amount_mismatch'
  | 'unknown_charge';

export interface RecordPaymentOutcome {
  result: RecordPaymentResult;
  chargeId: number | null;
}
