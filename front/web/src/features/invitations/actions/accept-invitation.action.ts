'use server';

import { redirect } from 'next/navigation';
import { startSession } from '@/features/auth/services/session.service';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import { field, UNEXPECTED_ERROR, type FormState } from '@/shared/forms/form-state.type';
import { parseAcceptForm, type AcceptField } from '../policies/accept-form.policy';

export type AcceptState = FormState<AcceptField>;

/**
 * Aceptar una invitación (público). El token se liga con .bind() desde la
 * página; la API decide el negocio y el rol. Sirve una sola vez.
 */
export async function acceptInvitation(
  token: string,
  _previous: AcceptState,
  form: FormData,
): Promise<AcceptState> {
  const values = { name: field(form, 'name'), username: field(form, 'username') };
  const parsed = parseAcceptForm(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  try {
    const { accessToken } = await apiRequest<{ accessToken: string }>(
      `/invitations/token/${encodeURIComponent(token)}/accept`,
      { method: 'POST', body: parsed.data },
    );
    await startSession(accessToken);
  } catch (error) {
    return { formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR, values };
  }
  redirect('/panel');
}
