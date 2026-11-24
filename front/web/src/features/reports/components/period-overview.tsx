import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatMoney } from '@/shared/format/format';
import { METHOD_LABELS, OVERVIEW_DAYS } from '../constants/overview.constants';
import type { ReportOverview } from '../interfaces/report-overview.interface';
import { DailyChart } from './daily-chart';

const percent = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 0 });
const rangeDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);

/** 14 → "2–3 p.m.", 11 → "11 a.m.–12 p.m." */
export function hourRange(hour: number): string {
  const h12 = (h: number) => h % 12 || 12;
  const period = (h: number) => (h < 12 ? 'a.m.' : 'p.m.');
  const next = (hour + 1) % 24;
  return period(hour) === period(next)
    ? `${h12(hour)}–${h12(next)} ${period(hour)}`
    : `${h12(hour)} ${period(hour)}–${h12(next)} ${period(next)}`;
}

function Kpi({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{value}</span>
      {detail && <span className="text-sm text-zinc-600">{detail}</span>}
    </div>
  );
}

/** Cambio contra el periodo anterior: flecha + texto, nunca solo color. */
function Change({ change, days }: { change: number | null; days: number }) {
  if (change === null) return <>Sin cobros en los {days} días anteriores</>;
  if (Math.abs(change) < 0.005) return <>Igual que los {days} días anteriores</>;
  const up = change > 0;
  return (
    <span className={up ? 'text-emerald-700' : 'text-red-700'}>
      <span aria-hidden="true">{up ? '▲' : '▼'} </span>
      {up ? '+' : '−'}
      {percent.format(Math.abs(change))} vs. {days} días anteriores
    </span>
  );
}

/** Resumen de un periodo: indicadores, lo cobrado por día y por medio de pago. */
export function PeriodOverview({ overview }: { overview: ReportOverview }) {
  const { days, paid } = overview;
  const methodsTotal = overview.byMethod.reduce((sum, m) => sum + m.amount, 0);

  return (
    <section aria-labelledby="period-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="period-title" className="text-lg font-semibold text-zinc-900">
            Últimos {days} días
          </h2>
          <p className="text-sm text-zinc-500">
            Del {rangeDate.format(asDate(overview.from))} al {rangeDate.format(asDate(overview.to))}
          </p>
        </div>
        <nav aria-label="Periodo" className="inline-flex rounded-lg bg-zinc-100 p-1 text-sm">
          {OVERVIEW_DAYS.map((d) => (
            <Link
              key={d}
              href={d === 7 ? '/panel' : `/panel?dias=${d}`}
              scroll={false}
              aria-current={d === days ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                d === days ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {d} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Cobrado"
          value={formatMoney(paid.amount)}
          detail={<Change change={overview.paidChange} days={days} />}
        />
        <Kpi
          label="Ticket promedio"
          value={overview.averageTicket === null ? '—' : formatMoney(overview.averageTicket)}
          detail={`${paid.count} ${paid.count === 1 ? 'cobro pagado' : 'cobros pagados'}`}
        />
        <Kpi
          label="Tasa de pago"
          value={overview.paymentRate === null ? '—' : percent.format(overview.paymentRate)}
          detail="De los cobros que ya terminaron"
        />
        <Kpi
          label="Hora pico"
          value={overview.peakHour === null ? '—' : hourRange(overview.peakHour)}
          detail="Cuándo se pagan más cobros"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">Cobrado por día</h3>
          {paid.count === 0 ? (
            <EmptyState>Todavía no hay cobros pagados en este periodo.</EmptyState>
          ) : (
            <DailyChart daily={overview.daily} />
          )}
        </div>

        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">Cómo te pagan</h3>
          {methodsTotal === 0 ? (
            <EmptyState>Aquí verás cuánto entra por push, QR y liga de pago.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-4">
              {overview.byMethod.map((m) => {
                const share = m.amount / methodsTotal;
                return (
                  <li key={m.method} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-zinc-800">{METHOD_LABELS[m.method]}</span>
                      <span className="tabular-nums text-zinc-600">
                        {formatMoney(m.amount)} · {percent.format(share)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100" aria-hidden="true">
                      <div
                        className="h-2 rounded-full bg-emerald-600"
                        style={{ width: m.amount > 0 ? `max(${share * 100}%, 4px)` : 0 }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">
                      {m.count} {m.count === 1 ? 'cobro' : 'cobros'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-zinc-200 px-6 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
