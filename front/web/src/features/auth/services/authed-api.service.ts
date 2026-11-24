import 'server-only';
import { redirect } from 'next/navigation';
import { ApiError, type ApiRequestOptions } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import { sessionToken } from './session.service';

/**
 * Llama a la API con el token de la sesión. Sin sesión, o si la API dice que
 * el token ya no sirve (401), manda a Entrar. Los demás errores los decide quien llama.
 */
export async function authedRequest<T>(
  path: string,
  options: Omit<ApiRequestOptions, 'token'> = {},
): Promise<T> {
  const token = await sessionToken();
  if (!token) redirect('/entrar');
  try {
    return await apiRequest<T>(path, { ...options, token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/entrar');
    throw error;
  }
}
