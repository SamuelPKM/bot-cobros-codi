import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import { formatMoney } from '@/shared/format/format';
import { ROLE_LABELS } from '@/shared/ui/role-options';
import { MemberEditForm } from './member-edit-form';

/** El equipo; cada persona se edita abriendo su fila. */
export function TeamList({ members }: { members: PublicUser[] }) {
  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200">
      {members.map((member) => (
        <li key={member.id}>
          <details className="group px-4 py-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-zinc-900">{member.name}</span>
              <span className="text-sm text-zinc-600">@{member.username}</span>
              <span className="text-sm text-zinc-600">{ROLE_LABELS[member.role]}</span>
              {member.maxAmount !== null && (
                <span className="text-sm text-zinc-600">tope {formatMoney(member.maxAmount)}</span>
              )}
              {!member.active && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">Desactivada</span>
              )}
              <span className="ml-auto text-sm text-emerald-800 underline group-open:hidden">Editar</span>
            </summary>
            <div className="pt-4">
              <MemberEditForm member={member} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
