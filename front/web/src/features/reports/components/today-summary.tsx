import type { ReactNode } from 'react';
import { formatMoney } from '@/shared/format/format';
import type { DailySummary } from '../interfaces/daily-summary.interface';

const plural = (n: number) => `${n} ${n === 1 ? 'cobro' : 'cobros'}`;

function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col rounded-lg border border-zinc-200 p-4">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-zinc-900">{value}</span>
      {detail && <span className="text-sm text-zinc-600">{detail}</span>}
    </div>
  );
}

/** Corte de hoy (hora de la Ciudad de México), como lo calcula la API. */
export function TodaySummary({ summary }: { summary: DailySummary }) {
  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-4">
      <h2 id="today-title" className="text-lg font-semibold text-zinc-900">
        Hoy
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Cobrado hoy" value={formatMoney(summary.paid.amount)} detail={plural(summary.paid.count)} />
        <Stat label="Pendiente" value={formatMoney(summary.pending.amount)} detail={plural(summary.pending.count)} />
        <Stat label="Vencidos" value={summary.expired.count} />
      </div>
      {summary.byPerson && summary.byPerson.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-600">
            <tr>
              <th className="py-2 pr-3 font-medium">Persona</th>
              <th className="py-2 pr-3 font-medium">Cobrado</th>
              <th className="py-2 pr-3 font-medium">Pagados</th>
              <th className="py-2 font-medium">Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {summary.byPerson.map((person) => (
              <tr key={person.userId} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{person.name}</td>
                <td className="py-2 pr-3 tabular-nums">{formatMoney(person.paidAmount)}</td>
                <td className="py-2 pr-3 tabular-nums">{person.paidCount}</td>
                <td className="py-2 tabular-nums">{person.pendingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
