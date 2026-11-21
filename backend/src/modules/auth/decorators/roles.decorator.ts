import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../users/types/role.type';

export const ROLES = 'roles';

/** Restringe una ruta o un controlador a ciertos roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
