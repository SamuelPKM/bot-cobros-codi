import { statusLabel } from '../policies/charge-view.policy';
import type { ChargeStatus } from '../types/charge.types';

const COLORS: Record<ChargeStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  paid: 'bg-emerald-100 text-emerald-900',
  expired: 'bg-zinc-200 text-zinc-700',
  cancelled: 'bg-zinc-200 text-zinc-700',
};

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {statusLabel(status)}
    </span>
  );
}
