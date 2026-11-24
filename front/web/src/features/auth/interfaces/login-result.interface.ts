import type { PublicUser } from '@/shared/interfaces/public-user.interface';

/** Respuesta de POST /auth/login de la API. */
export interface LoginResult {
  tokenType: 'Bearer';
  accessToken: string;
  user: PublicUser;
}
