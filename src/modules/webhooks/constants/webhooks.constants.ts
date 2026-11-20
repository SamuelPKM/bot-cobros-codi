import type { AttemptKind } from '../../charges/types/charge.types';

/** Eventos de pago CoDi que procesamos, y el tipo de intento que pagan. */
export const CODI_PAYMENT_EVENTS: Readonly<Record<string, AttemptKind>> = {
  'codi.pn.payment_received': 'push',
  'codi.qr.payment_received': 'qr',
};

export const PEY_SOURCE = 'pey';
