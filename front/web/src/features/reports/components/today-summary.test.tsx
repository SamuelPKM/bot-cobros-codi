import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DailySummary } from '../interfaces/daily-summary.interface';
import { TodaySummary } from './today-summary';

const summary: DailySummary = {
  date: '2026-12-01',
  paid: { count: 3, amount: 450, tips: 0 },
  pending: { count: 1, amount: 80 },
  expired: { count: 2 },
  byPerson: [
    { userId: 1, name: 'Ana', role: 'admin', paidCount: 2, paidAmount: 300, paidTips: 45, pendingCount: 0 },
    { userId: 2, name: 'Leo', role: 'seller', paidCount: 1, paidAmount: 150, paidTips: 0, pendingCount: 1 },
  ],
};

describe('TodaySummary', () => {
  it('muestra lo cobrado, lo pendiente y lo vencido de hoy', () => {
    render(<TodaySummary summary={summary} />);
    const paid = screen.getByRole('group', { name: 'Cobrado hoy' });
    expect(within(paid).getByText('$450.00')).toBeInTheDocument();
    expect(within(paid).getByText('3 cobros')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Pendiente' })).getByText('$80.00')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Vencidos' })).getByText('2')).toBeInTheDocument();
  });

  it('el admin ve el desglose por persona', () => {
    render(<TodaySummary summary={summary} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[1]).getByText('Leo')).toBeInTheDocument();
    expect(within(rows[1]).getByText('$150.00')).toBeInTheDocument();
  });

  it('con propinas, el detalle de lo cobrado las menciona', () => {
    render(<TodaySummary summary={{ ...summary, paid: { count: 3, amount: 450, tips: 45 } }} />);
    const paid = screen.getByRole('group', { name: 'Cobrado hoy' });
    expect(within(paid).getByText('3 cobros · $45.00 de propina')).toBeInTheDocument();
  });

  it('la tabla por persona trae la columna Propinas', () => {
    render(<TodaySummary summary={summary} />);
    expect(screen.getByRole('columnheader', { name: 'Propinas' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('$45.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('—')).toBeInTheDocument();
  });

  it('el vendedor no tiene desglose', () => {
    render(<TodaySummary summary={{ ...summary, byPerson: null }} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Cobrado hoy' })).getByText('3 cobros')).toBeInTheDocument();
  });
});
