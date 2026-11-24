import 'server-only';
import { redirect } from 'next/navigation';
import { ApiError } from '@/shared/api/api-client';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import { authedRequest } from './authed-api.service';

/**
 * Capa de acceso a datos de la sesión: quién es la persona, según la API.
 * Sin sesión válida (o cuenta desactivada) manda a Entrar. Llámala dentro de
 * un <Suspense> (lee cookies).
 */
export async function getCurrentUser(): Promise<PublicUser> {
  try {
    const { user } = await authedRequest<{ user: PublicUser }>('/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect('/entrar');
    throw error;
  }
}
