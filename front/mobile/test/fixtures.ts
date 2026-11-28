import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import type { PublicCharge } from '@/features/charges/interfaces/public-charge.interface';
import type { DailySummary } from '@/features/reports/interfaces/daily-summary.interface';

/** Persona ficticia para pruebas. */
export const aUser = (overrides: Partial<PublicUser> = {}): PublicUser => ({
  id: 7,
  businessId: 1,
  username: 'ana',
  name: 'Ana Prueba',
  role: 'seller',
  active: true,
  maxAmount: null,
  ...overrides,
});

const base64url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** JWT con firma falsa que vence en `seconds` segundos. */
export const aToken = (seconds = 3600): string =>
  [
    'eyJhbGciOiJIUzI1NiJ9',
    base64url(JSON.stringify({ sub: 7, exp: Math.floor(Date.now() / 1000) + seconds })),
    'firma',
  ].join('.');

/** Cobro ficticio pendiente por push. */
export const aCharge = (overrides: Partial<PublicCharge> = {}): PublicCharge => ({
  id: 7,
  status: 'pending',
  amount: 150,
  subtotal: 150,
  tip: 0,
  concept: 'corte',
  payerPhone: '5512345678',
  seller: { id: 7, name: 'Ana Prueba' },
  paidVia: null,
  paidAt: null,
  createdAt: '2026-12-01T18:05:00Z',
  attempts: [
    { id: 1, kind: 'push', status: 'pending', expiresAt: null, error: null, qrString: null, linkUrl: null },
  ],
  ...overrides,
});

/** Resumen del día ficticio. */
export const aSummary = (overrides: Partial<DailySummary> = {}): DailySummary => ({
  date: '2026-12-01',
  paid: { count: 3, amount: 450, tips: 0 },
  pending: { count: 1, amount: 80 },
  expired: { count: 2 },
  byPerson: null,
  ...overrides,
});
