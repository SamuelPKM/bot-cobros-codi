import 'server-only';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';

/** Todo el equipo del negocio (solo admin). */
export async function listTeam(): Promise<PublicUser[]> {
  const { users } = await authedRequest<{ users: PublicUser[] }>('/users');
  return users;
}
