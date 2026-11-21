import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Marca una ruta como pública. Todas las demás exigen `Authorization: Bearer <jwt>`
 * (el guard es global: cerrado por defecto).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
