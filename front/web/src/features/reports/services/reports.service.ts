import 'server-only';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { OVERVIEW_DAYS, type OverviewDays } from '../constants/overview.constants';
import type { DailySummary } from '../interfaces/daily-summary.interface';
import type { ReportOverview } from '../interfaces/report-overview.interface';

export function getTodaySummary(): Promise<DailySummary> {
  return authedRequest<DailySummary>('/reports/today');
}

/** Resumen de los últimos `days` días contra los anteriores, con el nombre del negocio. */
export function getOverview(days: OverviewDays): Promise<ReportOverview> {
  return authedRequest<ReportOverview>(`/reports/overview?days=${days}`);
}

/** "?dias=30" → 30. Cualquier otra cosa → 7. */
export function parseOverviewDays(value: string | string[] | undefined): OverviewDays {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (OVERVIEW_DAYS as readonly number[]).includes(n) ? (n as OverviewDays) : 7;
}

/** CSV de cobros de la API (UTF-8 con BOM, protegido contra fórmulas). `query`: "?from=…&to=…" o "". */
export function exportChargesCsv(query: string): Promise<string> {
  return authedRequest<string>(`/reports/charges.csv${query}`, { responseType: 'text' });
}
