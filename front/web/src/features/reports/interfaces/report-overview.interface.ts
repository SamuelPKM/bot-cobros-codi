/** GET /reports/overview de la API. Montos en pesos; fechas YYYY-MM-DD en la Ciudad de México. */
export type PaymentMethod = 'push' | 'qr' | 'link';

export interface DayTotal {
  date: string;
  count: number;
  amount: number;
}

export interface MethodTotal {
  method: PaymentMethod;
  count: number;
  amount: number;
}

export interface ReportOverview {
  businessName: string;
  days: number;
  from: string;
  to: string;
  paid: { count: number; amount: number };
  previousPaidAmount: number;
  /** 0.25 = +25% contra el periodo anterior; null si antes no hubo cobros pagados. */
  paidChange: number | null;
  averageTicket: number | null;
  /** Pagados entre los que ya terminaron (0 a 1); null si ninguno terminó. */
  paymentRate: number | null;
  daily: DayTotal[];
  byMethod: MethodTotal[];
  /** 0-23; null sin cobros pagados. */
  peakHour: number | null;
}
