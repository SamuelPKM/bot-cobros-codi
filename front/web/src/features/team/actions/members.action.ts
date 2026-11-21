'use server';

import { refresh } from 'next/cache';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { field, UNEXPECTED_ERROR, type FormState } from '@/shared/forms/form-state.type';
import {
  parseMemberUpdate,
  parseNewSeller,
  type MemberField,
  type NewSellerField,
} from '../policies/member-form.policy';

export type NewSellerState = FormState<NewSellerField>;
export type MemberState = FormState<MemberField>;

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : UNEXPECTED_ERROR);

/** Alta directa de un vendedor (admin). La contraseña nunca regresa al navegador. */
export async function createSeller(_previous: NewSellerState, form: FormData): Promise<NewSellerState> {
  const values = {
    name: field(form, 'name'),
    username: field(form, 'username'),
    maxAmount: field(form, 'maxAmount'),
  };
  const parsed = parseNewSeller(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  try {
    await authedRequest('/users', { method: 'POST', body: parsed.data });
  } catch (error) {
    return { formError: messageOf(error), values };
  }
  refresh();
  return {
    notice: `Listo: ${parsed.data.name} ya puede entrar con su usuario ${parsed.data.username}.`,
  };
}

/** Editar a una persona: nombre, rol, activa, tope o contraseña nueva. */
export async function updateMember(_previous: MemberState, form: FormData): Promise<MemberState> {
  const parsed = parseMemberUpdate(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  try {
    await authedRequest(`/users/${parsed.data.userId}`, { method: 'PATCH', body: parsed.data.body });
  } catch (error) {
    return { formError: messageOf(error) };
  }
  refresh();
  return { notice: 'Listo, guardado.' };
}
