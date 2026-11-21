import 'server-only';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import type { DailySummary } from '../interfaces/daily-summary.interface';

export function getTodaySummary(): Promise<DailySummary> {
  return authedRequest<DailySummary>('/reports/today');
}
