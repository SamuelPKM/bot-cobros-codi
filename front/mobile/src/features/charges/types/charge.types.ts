// Igual que en la API (backend/src/modules/charges/types/charge.types.ts).

export type ChargeStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

/** push al celular, QR que se escanea, o liga de pago que se reenvía. */
export type AttemptKind = 'push' | 'qr' | 'link';
export type ChargeMethod = AttemptKind;

export type AttemptStatus = 'sending' | 'pending' | 'unknown' | 'paid' | 'expired' | 'failed';
