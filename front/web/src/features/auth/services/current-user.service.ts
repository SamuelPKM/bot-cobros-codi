import 'server-only';
import { redirect } from 'next/navigation';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import { sessionToken } from './session.service';

/**
 * Capa de acceso a datos de la sesión: quién es la persona, según la API.
 * Sin sesión válida manda a Entrar. Llámala dentro de un <Suspense> (lee cookies).
 */
export async function getCurrentUser(): Promise<PublicUser> {
  const token = await sessionToken();
  if (!token) redirect('/entrar');
  try {
    const { user } = await apiRequest<{ user: PublicUser }>('/me', { token });
    return user;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403))
      redirect('/entrar');
    throw error;
  }
}
