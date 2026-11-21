/** Eventos de pago CoDi que procesamos, y el tipo de intento que pagan. */
export const CODI_PAYMENT_EVENTS: Readonly<Record<string, 'push' | 'qr'>> = {
  'codi.pn.payment_received': 'push',
  'codi.qr.payment_received': 'qr',
};

/** Cambio de estado de una liga de pago. */
export const PAYMENT_LINK_EVENT = 'payment_link.status_updated';

export const PEY_SOURCE = 'pey';
