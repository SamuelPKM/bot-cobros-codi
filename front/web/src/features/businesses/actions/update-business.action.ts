'use server';

import { refresh } from 'next/cache';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { UNEXPECTED_ERROR, type FormState } from '@/shared/forms/form-state.type';
import {
  parseBusinessSettings,
  type BusinessSettingsField,
} from '../policies/business-settings.policy';

export type BusinessSettingsState = FormState<BusinessSettingsField>;

/**
 * Ajustes del negocio (solo admin; la API lo revisa). Una nueva API key se
 * valida con pey antes de guardarse. La llave y el secreto nunca regresan al navegador.
 */
export async function updateBusiness(
  _previous: BusinessSettingsState,
  form: FormData,
): Promise<BusinessSettingsState> {
  const parsed = parseBusinessSettings(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  try {
    await authedRequest('/businesses/me', { method: 'PATCH', body: parsed.data });
  } catch (error) {
    return { formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR };
  }
  refresh();
  return { notice: 'Listo, guardado.' };
}
