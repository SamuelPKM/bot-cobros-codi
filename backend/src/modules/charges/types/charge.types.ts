/**
 * Un cobro (Charge) es una venta. Cada push o QR es un intento de pago
 * (PaymentAttempt) de esa venta: así el QR de respaldo pertenece al mismo
 * cobro y el corte nunca cuenta una venta dos veces.
 */

/** pending -> paid | expired | cancelled */
export const CHARGE_STATUSES = [
  'pending',
  'paid',
  'expired',
  'cancelled',
] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/** push al celular, QR que se escanea, o liga de pago que se reenvía. */
export const ATTEMPT_KINDS = ['push', 'qr', 'link'] as const;
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];

/** Con qué se cobra al crear el cobro. Solo el push necesita el celular. */
export const CHARGE_METHODS = ATTEMPT_KINDS;
export type ChargeMethod = AttemptKind;

/**
 * sending -> pending -> paid | expired
 * sending -> failed   (pey lo rechazó: no salió nada)
 * sending -> unknown  (timeout o red: no se sabe si salió; nunca se reintenta)
 */
export const ATTEMPT_STATUSES = [
  'sending',
  'pending',
  'unknown',
  'paid',
  'expired',
  'failed',
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
