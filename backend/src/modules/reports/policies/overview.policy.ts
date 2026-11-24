// Cálculos del resumen de un periodo, sin base de datos: reciben lo que
// agrupa la consulta y arman lo que ve el panel.

import { centsToPesos } from '../../../shared/money/money';
import type { AttemptKind } from '../../charges/types/charge.types';
import type { DayTotal, MethodTotal } from '../interfaces/report.interfaces';

const DAY_MS = 86_400_000;

/** Fila de la consulta: cobros de un día (de creación) y un estado. */
export interface DayStatusRow {
  day: string;
  status: string;
  count: number | string;
  cents: number | string;
}

export interface MethodRow {
  method: AttemptKind | null;
  count: number | string;
  cents: number | string;
}

/** Suma `days` días a una fecha YYYY-MM-DD (negativo para restar). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** El periodo de `days` días que termina `to`, y el mismo largo justo antes. */
export function periodRange(to: string, days: number) {
  const from = addDays(to, -(days - 1));
  return {
    from,
    to,
    previousFrom: addDays(from, -days),
    previousTo: addDays(from, -1),
  };
}

/** Lo pagado por día, con los días sin cobros en cero y en orden. */
export function dailyPaid(
  from: string,
  days: number,
  rows: DayStatusRow[],
): DayTotal[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const paid = rows.filter((r) => r.day === date && r.status === 'paid');
    return {
      date,
      count: paid.reduce((sum, r) => sum + Number(r.count), 0),
      amount: centsToPesos(paid.reduce((sum, r) => sum + Number(r.cents), 0)),
    };
  });
}

/**
 * De los cobros que ya terminaron (pagados, vencidos o cancelados), qué
 * parte se pagó. null si ninguno ha terminado: los pendientes no cuentan.
 */
export function paymentRate(rows: DayStatusRow[]): number | null {
  const count = (statuses: string[]) =>
    rows
      .filter((r) => statuses.includes(r.status))
      .reduce((sum, r) => sum + Number(r.count), 0);
  const closed = count(['paid', 'expired', 'cancelled']);
  return closed === 0 ? null : count(['paid']) / closed;
}

/** Pagos por medio (push, QR, liga), siempre los tres y en ese orden. */
export function byMethod(rows: MethodRow[]): MethodTotal[] {
  return (['push', 'qr', 'link'] as const).map((method) => {
    const row = rows.find((r) => r.method === method);
    return {
      method,
      count: Number(row?.count ?? 0),
      amount: centsToPesos(Number(row?.cents ?? 0)),
    };
  });
}

/** Cambio contra el periodo anterior (0.25 = +25%). null si antes no hubo nada. */
export function change(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}
