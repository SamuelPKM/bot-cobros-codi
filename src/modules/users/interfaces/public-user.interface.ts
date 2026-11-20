import type { Role } from '../types/role.type';

/** El usuario como lo ve la app: sin hash y con el tope en pesos. */
export interface PublicUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  maxAmount: number | null;
}
