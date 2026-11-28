import type { AttemptKind } from '../../charges/types/charge.types';
import type { Role } from '../../users/types/role.type';

export interface PersonSummary {
  userId: number;
  name: string;
  role: Role;
  paidCount: number;
  /** En pesos. */
  paidAmount: number;
  /** Propinas incluidas en `paidAmount`. En pesos. */
  paidTips: number;
  pendingCount: number;
}

/** Corte del día. Montos en pesos. */
export interface DailySummary {
  /** YYYY-MM-DD en la Ciudad de México. */
  date: string;
  /** `amount` es el total cobrado; `tips` las propinas incluidas en él. */
  paid: { count: number; amount: number; tips: number };
  pending: { count: number; amount: number };
  expired: { count: number };
  /** Solo para el admin: cada persona del equipo. null para un vendedor. */
  byPerson: PersonSummary[] | null;
}

export interface DayTotal {
  /** YYYY-MM-DD en la Ciudad de México. */
  date: string;
  /** Cobros pagados creados ese día. */
  count: number;
  /** En pesos. */
  amount: number;
}

export interface MethodTotal {
  method: AttemptKind;
  count: number;
  /** En pesos. */
  amount: number;
}

/** Resumen de un periodo para el panel. Montos en pesos. */
export interface ReportOverview {
  businessName: string;
  /** Versión del logo del negocio (GET /businesses/me/logo); null sin logo. */
  logoVersion: string | null;
  days: number;
  /** YYYY-MM-DD, ambos incluidos, en la Ciudad de México. */
  from: string;
  to: string;
  paid: { count: number; amount: number; tips: number };
  /** Lo cobrado en los `days` días anteriores a `from`. */
  previousPaidAmount: number;
  /** Cambio contra el periodo anterior (0.25 = +25%); null si antes no hubo cobros pagados. */
  paidChange: number | null;
  /** Monto promedio de un cobro pagado; null sin cobros pagados. */
  averageTicket: number | null;
  /** Pagados entre los que ya terminaron (pagados, vencidos, cancelados); null si ninguno terminó. */
  paymentRate: number | null;
  /** Un elemento por día del periodo, en orden, con ceros. */
  daily: DayTotal[];
  /** Siempre push, qr y link, en ese orden. */
  byMethod: MethodTotal[];
  /** Hora del día (0-23, Ciudad de México) con más cobros pagados; null sin cobros pagados. */
  peakHour: number | null;
}

export interface ChargesExport {
  filename: string;
  csv: string;
}
