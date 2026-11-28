import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { ChargesTable } from './charges-table';

const charge = (over: Partial<PublicCharge>): PublicCharge => ({
  id: 1,
  status: 'pending',
  amount: 150,
  subtotal: 150,
  tip: 0,
  concept: 'corte',
  payerPhone: '5512345678',
  seller: { id: 1, name: 'Ana' },
  paidVia: null,
  paidAt: null,
  createdAt: '2026-12-01T18:05:00Z',
  attempts: [],
  ...over,
});

describe('ChargesTable', () => {
  it('una fila por cobro con estado, monto, cliente y quién cobró', () => {
    render(
      <ChargesTable
        charges={[
          charge({ id: 1 }),
          charge({ id: 2, status: 'paid', amount: 80, payerPhone: null, concept: null, paidVia: 'qr' }),
        ]}
        showSeller
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Pendiente')).toBeInTheDocument();
    expect(within(rows[0]).getByText('$150.00')).toBeInTheDocument();
    expect(within(rows[0]).getByText('55 1234 5678')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Ana')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: /Ver cobro 1/ })).toHaveAttribute('href', '/panel/cobros/1');
    expect(within(rows[1]).getByText('Pagado')).toBeInTheDocument();
  });

  it('columnas Total y Propina; la propina vacía se muestra como guion', () => {
    render(
      <ChargesTable
        charges={[charge({ id: 1, amount: 115, subtotal: 100, tip: 15 }), charge({ id: 2 })]}
        showSeller={false}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Propina' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Monto' })).not.toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('$115.00')).toBeInTheDocument();
    expect(within(rows[0]).getByText('$15.00')).toBeInTheDocument();
    expect(within(rows[1]).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('el vendedor no ve la columna de quién cobró', () => {
    render(<ChargesTable charges={[charge({})]} showSeller={false} />);
    expect(screen.queryByRole('columnheader', { name: 'Cobró' })).not.toBeInTheDocument();
  });

  it('sin cobros invita a hacer el primero', () => {
    render(<ChargesTable charges={[]} showSeller />);
    expect(screen.getByText(/Aún no hay cobros/)).toBeInTheDocument();
  });
});
