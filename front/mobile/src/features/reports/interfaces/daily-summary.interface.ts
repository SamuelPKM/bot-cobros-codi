import type { Role } from '@/shared/interfaces/public-user.interface';

/** GET /reports/today de la API. Montos en pesos. */
export interface PersonSummary {
  userId: number;
  name: string;
  role: Role;
  paidCount: number;
  paidAmount: number;
  paidTips: number;
  pendingCount: number;
}

export interface DailySummary {
  /** YYYY-MM-DD en la Ciudad de México. */
  date: string;
  /** `amount` es el total, propinas incluidas. */
  paid: { count: number; amount: number; tips: number };
  pending: { count: number; amount: number };
  expired: { count: number };
  /** Solo el admin recibe el desglose; null para un vendedor. */
  byPerson: PersonSummary[] | null;
}
