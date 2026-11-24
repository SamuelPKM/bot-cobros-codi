'use server';

import { refresh } from 'next/cache';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { UNEXPECTED_ERROR, type FormState } from '@/shared/forms/form-state.type';

export type FallbackState = FormState<never>;

/**
 * Plan B del mismo cobro: QR para escanear o liga de pago para reenviar.
 * La API revisa que el cobro sea visible para la persona y siga pendiente.
 */
export async function showFallback(
  _previous: FallbackState,
  form: FormData,
): Promise<FallbackState> {
  const chargeId = Number(form.get('chargeId'));
  const kind = form.get('kind');
  if (!Number.isInteger(chargeId) || chargeId <= 0 || (kind !== 'qr' && kind !== 'link'))
    return { formError: UNEXPECTED_ERROR };

  try {
    await authedRequest(`/charges/${chargeId}/${kind}`, { method: 'POST' });
  } catch (error) {
    return { formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR };
  }
  refresh();
  return {};
}
