import type { ApiRequest } from '@/shared/api/api-client';
import type { DailySummary } from '../interfaces/daily-summary.interface';

/** Lo de hoy en la Ciudad de México; el admin recibe además el desglose por persona. */
export function getTodaySummary(request: ApiRequest): Promise<DailySummary> {
  return request<DailySummary>('/reports/today');
}
