import 'server-only';
import { ApiError } from '@/shared/api/api-client';
import { apiRequest } from '@/shared/api/server-api';
import type { DemoInfo } from '../interfaces/demo.interface';

/** Negocio y límites de la demo; null si la demo está apagada en la API. */
export async function getDemoInfo(): Promise<DemoInfo | null> {
  try {
    return await apiRequest<DemoInfo>('/demo');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
