'use server';

import { redirect } from 'next/navigation';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import { HOME_AFTER_LOGIN } from '../constants/session.constants';
import type { LoginResult } from '../interfaces/login-result.interface';
import { parseLoginForm } from '../policies/login-form.policy';
import { startSession } from '../services/session.service';
import type { LoginState } from '../types/login-state.type';

/** Entrar: la API valida usuario y contraseña; el token queda en una cookie httpOnly. */
export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const parsed = parseLoginForm(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, username: String(form.get('username') ?? '') };

  try {
    const result = await apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: parsed.data,
    });
    await startSession(result.accessToken);
  } catch (error) {
    return {
      formError:
        error instanceof ApiError
          ? error.message
          : 'Algo salió mal. Intenta de nuevo en un momento.',
      username: parsed.data.username,
    };
  }
  // Fuera del try: redirect() funciona lanzando una excepción.
  redirect(HOME_AFTER_LOGIN);
}
