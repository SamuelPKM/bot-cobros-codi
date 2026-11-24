import type { PublicUser } from '../../users/interfaces/public-user.interface';

/** Respuesta de POST /auth/login. */
export interface LoginResult {
  tokenType: 'Bearer';
  accessToken: string;
  user: PublicUser;
}
