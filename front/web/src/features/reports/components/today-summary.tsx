import type { ReactNode } from 'react';
import { formatMoney } from '@/shared/format/format';
import { Avatar } from '@/shared/ui/avatar';
import type { DailySummary } from '../interfaces/daily-summary.interface';

const plural = (n: number) => `${n} ${n === 1 ? 'cobro' : 'cobros'}`;

// Íconos de 20px, solo de adorno: el título de cada tarjeta dice qué es.
const icons = {
  paid: <path d="M5 10.5l3 3 7-7" />,
  pending: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.5" />
    </>
  ),
  expired: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
    </>
  ),
};

function Stat({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: keyof typeof icons;
  accent: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icons[icon]}
        </svg>
      </span>
      <div className="flex flex-col">
        <span className="text-sm text-zinc-600">{label}</span>
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{value}</span>
        {detail && <span className="text-sm text-zinc-600">{detail}</span>}
      </div>
    </div>
  );
}

/** Corte de hoy (hora de la Ciudad de México), como lo calcula la API. */
export function TodaySummary({ summary }: { summary: DailySummary }) {
  const best = summary.byPerson?.[0];
  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-4">
      <h2 id="today-title" className="text-lg font-semibold text-zinc-900">
        Hoy
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Cobrado hoy"
          value={formatMoney(summary.paid.amount)}
          detail={
            summary.paid.tips > 0
              ? `${plural(summary.paid.count)} · ${formatMoney(summary.paid.tips)} de propina`
              : plural(summary.paid.count)
          }
          icon="paid"
          accent="bg-emerald-50 text-emerald-700"
        />
        <Stat
          label="Pendiente"
          value={formatMoney(summary.pending.amount)}
          detail={plural(summary.pending.count)}
          icon="pending"
          accent="bg-amber-50 text-amber-700"
        />
        <Stat
          label="Vencidos"
          value={summary.expired.count}
          icon="expired"
          accent="bg-zinc-100 text-zinc-600"
        />
      </div>
      {summary.byPerson && summary.byPerson.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Persona</th>
                <th className="px-4 py-2.5 font-medium">Cobrado</th>
                <th className="px-4 py-2.5 font-medium">Propinas</th>
                <th className="px-4 py-2.5 font-medium">Pagados</th>
                <th className="px-4 py-2.5 font-medium">Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {summary.byPerson.map((person) => (
                <tr key={person.userId} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={person.name} size={28} />
                      <span className="whitespace-nowrap font-medium text-zinc-800">{person.name}</span>
                      {person === best && person.paidAmount > 0 && (
                        <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Más cobró hoy
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatMoney(person.paidAmount)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {person.paidTips > 0 ? formatMoney(person.paidTips) : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{person.paidCount}</td>
                  <td className="px-4 py-2.5 tabular-nums">{person.pendingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
