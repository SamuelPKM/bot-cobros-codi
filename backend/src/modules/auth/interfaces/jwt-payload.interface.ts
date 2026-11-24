import type { Role } from '../../users/types/role.type';

/** Contenido del Bearer token. El usuario se vuelve a leer de la base en cada petición. */
export interface JwtPayload {
  sub: number;
  role: Role;
}
