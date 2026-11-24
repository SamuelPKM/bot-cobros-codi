import { formatDateTime } from '@/shared/format/format';
import { ROLE_LABELS } from '@/shared/ui/role-options';
import { revokeInvitation } from '../actions/invitations.action';
import type { PublicInvitation } from '../interfaces/invitation.interface';

/** Invitaciones vigentes (sin la liga: esa solo se vio al crearlas). */
export function InvitationsList({ invitations }: { invitations: PublicInvitation[] }) {
  if (invitations.length === 0) return <p className="text-sm text-zinc-600">No hay invitaciones vigentes.</p>;
  return (
    <ul className="flex flex-col divide-y divide-zinc-100 text-sm">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>
            {ROLE_LABELS[invitation.role]} · vence el {formatDateTime(invitation.expiresAt)}
          </span>
          <form action={revokeInvitation}>
            <input type="hidden" name="invitationId" value={invitation.id} />
            <button type="submit" className="font-medium text-red-700 underline">
              Revocar
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
