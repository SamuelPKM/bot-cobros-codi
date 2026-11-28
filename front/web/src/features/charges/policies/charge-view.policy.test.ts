import { describe, expect, it } from 'vitest';
import type { PublicAttempt, PublicCharge } from '../interfaces/public-charge.interface';
import { activeQr, activeLink, statusLabel, isWaitingPayment } from './charge-view.policy';

const attempt = (over: Partial<PublicAttempt>): PublicAttempt => ({
  id: 1,
  kind: 'push',
  status: 'pending',
  expiresAt: null,
  error: null,
  qrString: null,
  linkUrl: null,
  ...over,
});

const charge = (over: Partial<PublicCharge>): PublicCharge => ({
  id: 7,
  status: 'pending',
  amount: 150,
  subtotal: 150,
  tip: 0,
  concept: 'corte',
  payerPhone: '5512345678',
  seller: { id: 1, name: 'Ana' },
  paidVia: null,
  paidAt: null,
  createdAt: '2026-12-01T18:00:00Z',
  attempts: [],
  ...over,
});

describe('charge-view.policy', () => {
  it('etiquetas de estado en español', () => {
    expect(statusLabel('pending')).toBe('Pendiente');
    expect(statusLabel('paid')).toBe('Pagado');
    expect(statusLabel('expired')).toBe('Vencido');
    expect(statusLabel('cancelled')).toBe('Cancelado');
  });

  it('el QR vigente es el último intento QR pendiente', () => {
    const c = charge({
      attempts: [
        attempt({ id: 1, kind: 'qr', status: 'expired', qrString: 'viejo' }),
        attempt({ id: 2, kind: 'push' }),
        attempt({ id: 3, kind: 'qr', status: 'pending', qrString: 'nuevo', expiresAt: '2026-12-01T18:15:00Z' }),
      ],
    });
    expect(activeQr(c)).toEqual({ qrString: 'nuevo', expiresAt: '2026-12-01T18:15:00Z' });
    expect(activeQr(charge({ status: 'paid', attempts: c.attempts }))).toBeNull();
  });

  it('la liga vigente es la del último intento de liga pendiente', () => {
    const c = charge({ attempts: [attempt({ kind: 'link', linkUrl: 'https://pey.test/l/1' })] });
    expect(activeLink(c)).toBe('https://pey.test/l/1');
    expect(activeLink(charge({}))).toBeNull();
  });

  it('se sigue consultando solo mientras está pendiente', () => {
    expect(isWaitingPayment(charge({}))).toBe(true);
    expect(isWaitingPayment(charge({ status: 'paid' }))).toBe(false);
  });
});
