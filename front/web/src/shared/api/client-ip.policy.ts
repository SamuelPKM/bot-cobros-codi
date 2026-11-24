import { isIP } from 'node:net';

/**
 * IP del visitante a partir de X-Forwarded-For. Se toma la ÚLTIMA entrada:
 * es la que agregó el proxy de la plataforma (Caddy en AWS); las anteriores
 * las pudo escribir el propio visitante. null si no hay una IP válida.
 */
export function clientIpFrom(forwardedFor: string | null): string | null {
  const last = forwardedFor?.split(',').at(-1)?.trim();
  return last && isIP(last) ? last : null;
}
