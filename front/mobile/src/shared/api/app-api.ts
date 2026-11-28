import { resolveApiUrl } from '../config/api-url.policy';
import { createApiClient, type ApiRequest } from './api-client';

export type AppApi = { ok: true; request: ApiRequest; apiBaseUrl: string } | { ok: false; error: string };

/**
 * Cliente de la API para la app. EXPO_PUBLIC_API_URL se escribe tal cual: Expo
 * la reemplaza al compilar (no sirve leerla de forma dinámica).
 */
export function createAppApi(): AppApi {
  try {
    const baseUrl = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
    const { request } = createApiClient({ baseUrl, fetch: (input, init) => fetch(input, init) });
    return { ok: true, request, apiBaseUrl: baseUrl };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
