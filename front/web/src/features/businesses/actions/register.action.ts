'use server';

import { redirect } from 'next/navigation';
import { startSession } from '@/features/auth/services/session.service';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import { field, UNEXPECTED_ERROR, type FormState } from '@/shared/forms/form-state.type';
import { parseRegisterForm, type RegisterField } from '../policies/register-form.policy';

export type RegisterState = FormState<RegisterField>;

/**
 * Registro público: el negocio con SU API key de pey (la API la verifica con
 * pey y la guarda cifrada) y su primer admin, que queda con la sesión abierta.
 */
export async function registerBusiness(
  _previous: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  // Nunca se devuelven la contraseña ni la API key al navegador.
  const values = {
    businessName: field(form, 'businessName'),
    adminName: field(form, 'adminName'),
    username: field(form, 'username'),
  };
  const parsed = parseRegisterForm(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  try {
    const { accessToken } = await apiRequest<{ accessToken: string }>('/businesses', {
      method: 'POST',
      body: parsed.data,
    });
    await startSession(accessToken);
  } catch (error) {
    return {
      formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR,
      values,
    };
  }
  // En el panel se le recuerda registrar el webhook de pey.
  redirect('/panel');
}
