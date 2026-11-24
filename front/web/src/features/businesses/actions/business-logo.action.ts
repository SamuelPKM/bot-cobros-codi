'use server';

import { refresh } from 'next/cache';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { UNEXPECTED_ERROR } from '@/shared/forms/form-state.type';
import { MAX_LOGO_BYTES } from '../constants/logo.constants';

export interface LogoState {
  error?: string;
  notice?: string;
}

const TOO_BIG = 'El logo debe pesar máximo 1 MB';

/** Sube o cambia el logo (solo admin; la API revisa el rol, el tipo y el tamaño). */
export async function uploadLogo(_previous: LogoState, form: FormData): Promise<LogoState> {
  const file = form.get('logo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Elige una imagen para el logo' };
  if (file.size > MAX_LOGO_BYTES) return { error: TOO_BIG };

  const body = new FormData();
  body.append('logo', file, file.name || 'logo');
  try {
    await authedRequest('/businesses/me/logo', { method: 'POST', body });
  } catch (error) {
    if (error instanceof ApiError && error.status === 413) return { error: TOO_BIG };
    return { error: error instanceof ApiError ? error.message : UNEXPECTED_ERROR };
  }
  refresh();
  return { notice: 'Listo, tu logo ya aparece en el panel.' };
}

export async function removeLogo(): Promise<LogoState> {
  try {
    await authedRequest('/businesses/me/logo', { method: 'DELETE' });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : UNEXPECTED_ERROR };
  }
  refresh();
  return { notice: 'Quitamos el logo: se muestran las iniciales del negocio.' };
}
