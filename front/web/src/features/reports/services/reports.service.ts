import 'server-only';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import type { DailySummary } from '../interfaces/daily-summary.interface';

export function getTodaySummary(): Promise<DailySummary> {
  return authedRequest<DailySummary>('/reports/today');
}

/** CSV de cobros de la API (UTF-8 con BOM, protegido contra fórmulas). `query`: "?from=…&to=…" o "". */
export function exportChargesCsv(query: string): Promise<string> {
  return authedRequest<string>(`/reports/charges.csv${query}`, { responseType: 'text' });
}
