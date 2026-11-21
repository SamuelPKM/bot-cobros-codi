import type { Role } from '../types/role.type';

/** Datos para crear un usuario (la contraseña llega en claro y se guarda con hash). */
export interface CreateUserInput {
  /** Negocio al que pertenece: todo lo que hace queda dentro de él. */
  businessId: number;
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
