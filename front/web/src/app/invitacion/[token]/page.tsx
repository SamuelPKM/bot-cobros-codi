import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AcceptInvitationForm } from '@/features/invitations/components/accept-invitation-form';
import { getInvitationPreview } from '@/features/invitations/services/invitations.service';
import { formatDateTime } from '@/shared/format/format';
import { ROLE_LABELS } from '@/shared/ui/role-options';

export const metadata: Metadata = {
  title: 'Únete al equipo · Cóbrale',
  // La liga lleva un token: que no se indexe ni se mande como referer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function InvitacionPage({ params }: PageProps<'/invitacion/[token]'>) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Suspense fallback={<p className="text-zinc-600">Cargando…</p>}>
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}

async function Invitation({ params }: { params: PageProps<'/invitacion/[token]'>['params'] }) {
  const { token } = await params;
  const lookup = await getInvitationPreview(token);

  if (!lookup.ok)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Esta invitación ya no sirve</h1>
        {/* La API ya explica qué pasó y que se pida otra. */}
        <p className="text-zinc-700">{lookup.message.replace(/\.?$/, '.')}</p>
        <Link href="/entrar" className="font-medium text-emerald-800 underline">
          Ya tengo cuenta: entrar
        </Link>
      </div>
    );

  const { invitation } = lookup;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Únete a {invitation.businessName}</h1>
        <p className="text-sm text-zinc-600">
          Entrarás como {ROLE_LABELS[invitation.role].toLowerCase()}. La invitación vence el{' '}
          {formatDateTime(invitation.expiresAt)}.
        </p>
      </div>
      <AcceptInvitationForm token={token} />
    </>
  );
}
