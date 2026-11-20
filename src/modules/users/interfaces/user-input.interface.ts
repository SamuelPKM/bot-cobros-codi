import type { Role } from '../types/role.type';

/** Datos para crear un usuario (la contraseña llega en claro y se guarda con hash). */
export interface CreateUserInput {
  username: string;
  name: string;
  role: Role;
  password: string;
  maxAmountCents?: number | null;
}

/** Campos editables de un usuario. `undefined` = no cambiar. */
export interface UpdateUserInput {
  name?: string;
  active?: boolean;
  maxAmountCents?: number | null;
  password?: string;
}
