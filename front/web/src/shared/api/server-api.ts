import 'server-only';
import { apiUrl } from '../config/server-env';
import { createApiClient, type ApiRequestOptions } from './api-client';

/** Llama a la API de Nest desde Server Components, Server Actions y Route Handlers. */
export function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return createApiClient({ baseUrl: apiUrl(), fetch: globalThis.fetch }).request<T>(
    path,
    options,
  );
}
