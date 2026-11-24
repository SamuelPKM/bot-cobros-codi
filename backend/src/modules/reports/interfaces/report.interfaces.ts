import type { Role } from '../../users/types/role.type';

export interface PersonSummary {
  userId: number;
  name: string;
  role: Role;
  paidCount: number;
  /** En pesos. */
  paidAmount: number;
  pendingCount: number;
}

/** Corte del día. Montos en pesos. */
export interface DailySummary {
  /** YYYY-MM-DD en la Ciudad de México. */
  date: string;
  paid: { count: number; amount: number };
  pending: { count: number; amount: number };
  expired: { count: number };
  /** Solo para el admin: cada persona del equipo. null para un vendedor. */
  byPerson: PersonSummary[] | null;
}

export interface ChargesExport {
  filename: string;
  csv: string;
}
