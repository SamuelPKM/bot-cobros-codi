import Link from 'next/link';
import { formatDateTime, formatMoney, formatPhone } from '@/shared/format/format';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { ChargeStatusBadge } from './charge-status-badge';

interface ChargesTableProps {
  charges: PublicCharge[];
  /** El admin ve quién cobró; el vendedor solo ve los suyos. */
  showSeller: boolean;
}

export function ChargesTable({ charges, showSeller }: ChargesTableProps) {
  if (charges.length === 0)
    return <p className="text-zinc-600">Aún no hay cobros. Haz el primero con «Nuevo cobro».</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-600">
          <tr>
            <th className="py-2 pr-3 font-medium">Estado</th>
            <th className="py-2 pr-3 font-medium">Monto</th>
            <th className="py-2 pr-3 font-medium">Cliente</th>
            <th className="py-2 pr-3 font-medium">Concepto</th>
            {showSeller && <th className="py-2 pr-3 font-medium">Cobró</th>}
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {charges.map((charge) => (
            <tr key={charge.id} className="border-b border-zinc-100">
              <td className="py-2 pr-3">
                <ChargeStatusBadge status={charge.status} />
              </td>
              <td className="py-2 pr-3 font-medium tabular-nums">{formatMoney(charge.amount)}</td>
              <td className="py-2 pr-3 tabular-nums">{formatPhone(charge.payerPhone)}</td>
              <td className="py-2 pr-3">{charge.concept ?? '—'}</td>
              {showSeller && <td className="py-2 pr-3">{charge.seller.name}</td>}
              <td className="py-2 pr-3 text-zinc-600">{formatDateTime(charge.createdAt)}</td>
              <td className="py-2">
                <Link href={`/panel/cobros/${charge.id}`} className="font-medium text-emerald-800 underline">
                  Ver <span className="sr-only">cobro {charge.id}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
