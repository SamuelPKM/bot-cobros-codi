import type { Role } from '../interfaces/public-user.interface';

export const ROLE_LABELS: Record<Role, string> = { seller: 'Vendedor', admin: 'Administrador' };

export const ROLE_OPTIONS = [
  { value: 'seller', label: ROLE_LABELS.seller },
  { value: 'admin', label: ROLE_LABELS.admin },
];
