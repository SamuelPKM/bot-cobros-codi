/** Roles de la app: el admin administra vendedores; el vendedor solo cobra. */
export const ROLE_VALUES = ['admin', 'seller'] as const;

export type Role = (typeof ROLE_VALUES)[number];
