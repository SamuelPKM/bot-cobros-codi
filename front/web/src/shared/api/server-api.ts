import 'server-only';
import { headers } from 'next/headers';
import { apiUrl, frontProxySecret } from '../config/server-env';
import { createApiClient, type ApiRequestOptions } from './api-client';
import { clientIpFrom } from './client-ip.policy';

/**
 * Llama a la API de Nest desde Server Components, Server Actions y Route Handlers.
 * Con FRONT_PROXY_SECRET manda la IP del visitante, para que los límites por IP
 * de la API cuenten a cada persona y no a este servidor.
 */
export async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return createApiClient({
    baseUrl: apiUrl(),
    fetch: globalThis.fetch,
    headers: await proxyHeaders(),
  }).request<T>(path, options);
}

async function proxyHeaders(): Promise<Record<string, string>> {
  const secret = frontProxySecret();
  if (!secret) return {};
  const ip = clientIpFrom((await headers()).get('x-forwarded-for'));
  return ip ? { 'x-cobrale-proxy': secret, 'x-cobrale-client-ip': ip } : {};
}
