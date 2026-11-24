import 'server-only';

/**
 * Variables del servidor de Next. Ninguna lleva el prefijo NEXT_PUBLIC_: el
 * navegador nunca habla con la API directamente (todo pasa por este servidor).
 */
export function apiUrl(): string {
  const value = process.env.API_URL?.trim();
  if (!value) throw new Error('Falta API_URL (la URL de la API de Nest) en el entorno');
  return value;
}

/** Mismo valor que FRONT_PROXY_SECRET de la API; opcional (sin él no se manda la IP). */
export function frontProxySecret(): string | undefined {
  return process.env.FRONT_PROXY_SECRET?.trim() || undefined;
}

export const isProduction = process.env.NODE_ENV === 'production';
