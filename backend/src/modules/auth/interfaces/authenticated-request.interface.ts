import type { User } from '../../users/entities/user.entity';

/** Petición HTTP después de JwtAuthGuard: trae al usuario autenticado. */
export interface AuthenticatedRequest {
  headers: Record<string, string | undefined>;
  user?: User;
}
