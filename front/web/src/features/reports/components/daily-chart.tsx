'use client';

import { useState } from 'react';
import { formatMoney } from '@/shared/format/format';
import type { DayTotal } from '../interfaces/report-overview.interface';

const dayOfWeek = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const asDate = (date: string) => new Date(`${date}T00:00:00Z`);
const plural = (n: number) => `${n} ${n === 1 ? 'cobro pagado' : 'cobros pagados'}`;

/** Un tope "redondo" para el eje: 130 → 150, 1,240 → 1,500. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Qué días llevan etiqueta abajo: todos en 7 días, uno de cada 5 o 15 en periodos largos. */
function labelEvery(days: number): number {
  if (days <= 7) return 1;
  if (days <= 31) return 5;
  return 15;
}

/**
 * Lo cobrado por día, en barras. Una sola serie: el título la nombra y no
 * lleva leyenda. Pasa el cursor (o el foco) por una barra para ver el detalle.
 */
export function DailyChart({ daily }: { daily: DayTotal[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...daily.map((d) => d.amount)));
  const every = labelEvery(daily.length);
  const short = daily.length <= 7;
  const hovered = active === null ? null : daily[active];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex gap-3">
        {/* Eje: tope, mitad y cero, en tinta tenue. */}
        <div aria-hidden="true" className="flex h-44 w-16 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-zinc-400">
          <span className="-translate-y-1/2">{formatMoney(max)}</span>
          <span>{formatMoney(max / 2)}</span>
          <span className="translate-y-1/2">$0</span>
        </div>
        <div className="relative h-44 flex-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-dashed border-zinc-200" />
            <div className="border-t border-dashed border-zinc-200" />
            <div className="border-t border-zinc-300" />
          </div>
          <ol
            aria-hidden="true"
            className="absolute inset-0 flex items-end gap-0.5"
            onMouseLeave={() => setActive(null)}
          >
            {daily.map((d, i) => {
              const height = (d.amount / max) * 100;
              return (
                <li
                  key={d.date}
                  className="group relative flex h-full flex-1 items-end justify-center"
                  onMouseEnter={() => setActive(i)}
                >
                  <span
                    className={`w-full max-w-10 rounded-t-[4px] transition-colors ${
                      active === i ? 'bg-emerald-700' : 'bg-emerald-600'
                    }`}
                    style={{ height: d.amount > 0 ? `max(${height}%, 3px)` : 0 }}
                  />
                </li>
              );
            })}
          </ol>
          {hovered && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: `${((active + 0.5) / daily.length) * 100}%` }}
            >
              <div className="font-medium first-letter:uppercase">{fullDate.format(asDate(hovered.date))}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">{formatMoney(hovered.amount)}</div>
              <div className="text-zinc-300">{plural(hovered.count)}</div>
            </div>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="ml-[4.75rem] flex gap-0.5 text-[11px] text-zinc-500">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 truncate text-center">
            {i % every === 0 || i === daily.length - 1
              ? short
                ? dayOfWeek.format(asDate(d.date)).replace('.', '')
                : dayMonth.format(asDate(d.date)).replace('.', '')
              : ''}
          </span>
        ))}
      </div>

      {/* La misma información, para lectores de pantalla y teclado. */}
      <table className="sr-only">
        <caption>Cobrado por día</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Cobrado</th>
            <th scope="col">Cobros pagados</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{fullDate.format(asDate(d.date))}</th>
              <td>{formatMoney(d.amount)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
