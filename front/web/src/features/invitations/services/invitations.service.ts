import 'server-only';
import { notFound } from 'next/navigation';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import type { InvitationPreview, PublicInvitation } from '../interfaces/invitation.interface';

/** Invitaciones vigentes del negocio (solo admin). */
export async function listInvitations(): Promise<PublicInvitation[]> {
  const { invitations } = await authedRequest<{ invitations: PublicInvitation[] }>('/invitations');
  return invitations;
}

export type InvitationLookup =
  | { ok: true; invitation: InvitationPreview }
  /** 410: ya se usó, venció o la revocaron. */
  | { ok: false; message: string };

/** Lo que ve la persona invitada (público). 404 si el token no existe. */
export async function getInvitationPreview(token: string): Promise<InvitationLookup> {
  try {
    const { invitation } = await apiRequest<{ invitation: InvitationPreview }>(
      `/invitations/token/${encodeURIComponent(token)}`,
    );
    return { ok: true, invitation };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.status === 410) return { ok: false, message: error.message };
    throw error;
  }
}
