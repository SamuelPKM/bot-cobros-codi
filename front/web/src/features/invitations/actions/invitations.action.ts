'use server';

import { refresh } from 'next/cache';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { UNEXPECTED_ERROR } from '@/shared/forms/form-state.type';
import type { Role } from '@/shared/interfaces/public-user.interface';
import type { CreatedInvitation } from '../interfaces/invitation.interface';

export interface CreateInvitationState {
  /** La liga recién creada; no se vuelve a poder ver. */
  created?: { url: string; role: Role; expiresAt: string };
  formError?: string;
}

/** Liga de un solo uso (7 días) para que alguien se una al equipo con ese rol. */
export async function createInvitation(
  _previous: CreateInvitationState,
  form: FormData,
): Promise<CreateInvitationState> {
  const role = form.get('role');
  if (role !== 'seller' && role !== 'admin') return { formError: 'Elige el rol de la invitación' };
  try {
    const { invitation } = await authedRequest<CreatedInvitation>('/invitations', {
      method: 'POST',
      body: { role },
    });
    refresh();
    return { created: { url: invitation.url, role: invitation.role, expiresAt: invitation.expiresAt } };
  } catch (error) {
    return { formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR };
  }
}

export async function revokeInvitation(form: FormData): Promise<void> {
  const id = Number(form.get('invitationId'));
  if (!Number.isInteger(id) || id <= 0) return;
  await authedRequest(`/invitations/${id}`, { method: 'DELETE' });
  refresh();
}
