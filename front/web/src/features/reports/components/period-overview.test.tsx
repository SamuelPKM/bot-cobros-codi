import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initials } from '@/shared/ui/avatar';
import { greeting } from '@/features/businesses/components/business-header';
import type { ReportOverview } from '../interfaces/report-overview.interface';
import { hourRange, PeriodOverview } from './period-overview';

const day = (date: string, amount: number, count: number) => ({ date, amount, count });

const overview: ReportOverview = {
  businessName: 'Tacos La Esquina',
  logoVersion: null,
  days: 7,
  from: '2026-11-18',
  to: '2026-11-24',
  paid: { count: 4, amount: 400 },
  previousPaidAmount: 320,
  paidChange: 0.25,
  averageTicket: 100,
  paymentRate: 0.8,
  daily: [
    day('2026-11-18', 0, 0),
    day('2026-11-19', 100, 1),
    day('2026-11-20', 0, 0),
    day('2026-11-21', 0, 0),
    day('2026-11-22', 200, 2),
    day('2026-11-23', 0, 0),
    day('2026-11-24', 100, 1),
  ],
  byMethod: [
    { method: 'push', count: 1, amount: 100 },
    { method: 'qr', count: 3, amount: 300 },
    { method: 'link', count: 0, amount: 0 },
  ],
  peakHour: 14,
};

describe('PeriodOverview', () => {
  it('muestra los indicadores del periodo, con el cambio en texto y no solo en color', () => {
    render(<PeriodOverview overview={overview} />);
    const paid = screen.getByRole('group', { name: 'Cobrado' });
    expect(within(paid).getByText('$400.00')).toBeInTheDocument();
    expect(within(paid).getByText(/\+25\s?% vs\. 7 días anteriores/)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Ticket promedio' })).getByText('$100.00')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Tasa de pago' })).getByText(/80\s?%/)).toBeInTheDocument();
  });

  it('marca el periodo elegido y enlaza los otros', () => {
    render(<PeriodOverview overview={overview} />);
    expect(screen.getByRole('link', { name: '7 días' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '30 días' })).toHaveAttribute('href', '/panel?dias=30');
  });

  it('reparte lo cobrado por medio de pago', () => {
    render(<PeriodOverview overview={overview} />);
    expect(screen.getByText('QR')).toBeInTheDocument();
    expect(screen.getByText(/\$300\.00 · 75\s?%/)).toBeInTheDocument();
  });

  it('trae una tabla con los días para lectores de pantalla', () => {
    render(<PeriodOverview overview={overview} />);
    const table = screen.getByRole('table', { name: 'Cobrado por día' });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
  });

  it('sin cobros pagados, explica en lugar de dibujar un gráfico vacío', () => {
    render(
      <PeriodOverview
        overview={{
          ...overview,
          paid: { count: 0, amount: 0 },
          paidChange: null,
          averageTicket: null,
          paymentRate: null,
          peakHour: null,
          daily: overview.daily.map((d) => ({ ...d, amount: 0, count: 0 })),
          byMethod: overview.byMethod.map((m) => ({ ...m, amount: 0, count: 0 })),
        }}
      />,
    );
    expect(screen.getByText('Todavía no hay cobros pagados en este periodo.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Sin cobros en los 7 días anteriores')).toBeInTheDocument();
  });
});

describe('hourRange', () => {
  it('escribe la hora pico corta, en formato de 12 horas', () => {
    expect(hourRange(14)).toBe('2–3 p.m.');
    expect(hourRange(11)).toBe('11 a.m.–12 p.m.');
    expect(hourRange(23)).toBe('11 p.m.–12 a.m.');
  });
});

describe('initials', () => {
  it('toma hasta dos iniciales e ignora signos', () => {
    expect(initials('Tacos La Esquina')).toBe('TL');
    expect(initials('ana')).toBe('A');
    expect(initials('  Óscar  ·  Núñez ')).toBe('ÓN');
  });
});

describe('greeting', () => {
  it('saluda según la hora de la Ciudad de México (UTC−6)', () => {
    expect(greeting(new Date('2026-11-24T15:00:00Z'))).toBe('Buenos días');
    expect(greeting(new Date('2026-11-24T21:00:00Z'))).toBe('Buenas tardes');
    expect(greeting(new Date('2026-11-25T03:00:00Z'))).toBe('Buenas noches');
  });
});
