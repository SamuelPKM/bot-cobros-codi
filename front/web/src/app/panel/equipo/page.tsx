import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/features/auth/services/current-user.service';
import { InvitationsList } from '@/features/invitations/components/invitations-list';
import { InviteForm } from '@/features/invitations/components/invite-form';
import { listInvitations } from '@/features/invitations/services/invitations.service';
import { NewSellerForm } from '@/features/team/components/new-seller-form';
import { TeamList } from '@/features/team/components/team-list';
import { listTeam } from '@/features/team/services/team.service';

export const metadata: Metadata = { title: 'Equipo · Cóbrale' };

export default function EquipoPage() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Equipo</h1>
      <Suspense fallback={<p className="text-zinc-600">Cargando…</p>}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  const user = await getCurrentUser();
  // Solo el admin administra el equipo (la API también lo revisa).
  if (user.role !== 'admin') redirect('/panel');
  const [members, invitations] = await Promise.all([listTeam(), listInvitations()]);

  return (
    <>
      <section aria-labelledby="members-title" className="flex flex-col gap-3">
        <h2 id="members-title" className="text-lg font-semibold text-zinc-900">
          Personas
        </h2>
        <TeamList members={members} />
      </section>
      <section aria-labelledby="invite-title" className="flex flex-col gap-3">
        <h2 id="invite-title" className="text-lg font-semibold text-zinc-900">
          Invitar con una liga
        </h2>
        <p className="text-sm text-zinc-700">
          La persona elige su usuario y contraseña. La liga dura 7 días y sirve una sola vez.
        </p>
        <InviteForm />
        <h3 className="mt-2 font-medium text-zinc-900">Invitaciones vigentes</h3>
        <InvitationsList invitations={invitations} />
      </section>
      <section aria-labelledby="new-seller-title" className="flex flex-col gap-3">
        <h2 id="new-seller-title" className="text-lg font-semibold text-zinc-900">
          Dar de alta a un vendedor
        </h2>
        <NewSellerForm />
      </section>
    </>
  );
}
