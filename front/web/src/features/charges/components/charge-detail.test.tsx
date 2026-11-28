import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicCharge } from '../interfaces/public-charge.interface';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../actions/charge-fallback.action', () => ({ chargeFallback: vi.fn() }));

const { ChargeDetail } = await import('./charge-detail');

const charge = (over: Partial<PublicCharge>): PublicCharge => ({
  id: 3,
  status: 'paid',
  amount: 115,
  subtotal: 100,
  tip: 15,
  concept: 'corte',
  payerPhone: '5512345678',
  seller: { id: 1, name: 'Ana' },
  paidVia: 'qr',
  paidAt: '2026-12-01T18:10:00Z',
  createdAt: '2026-12-01T18:05:00Z',
  attempts: [],
  ...over,
});

describe('ChargeDetail', () => {
  it('el monto grande es el total y desglosa la propina', async () => {
    render(await ChargeDetail({ charge: charge({}) }));
    expect(screen.getByText('$115.00')).toBeInTheDocument();
    expect(screen.getByText('Cobro $100.00 · Propina $15.00')).toBeInTheDocument();
  });

  it('sin propina no hay desglose', async () => {
    render(await ChargeDetail({ charge: charge({ amount: 100, tip: 0 }) }));
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText(/Propina/)).not.toBeInTheDocument();
  });
});
