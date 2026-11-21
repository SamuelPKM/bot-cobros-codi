import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

type Headers = Record<string, string | string[] | undefined>;

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * La IP del visitante que manda la web (Next) cuando llama desde su servidor.
 * Solo se acepta si trae el secreto compartido (comparado en tiempo constante)
 * y es una IP válida; si no, null y se usa la IP de la conexión.
 */
export function forwardedClientIp(
  headers: Headers,
  secret: string | undefined,
): string | null {
  const presented = headers['x-cobrale-proxy'];
  const ip = headers['x-cobrale-client-ip'];
  if (!secret || typeof presented !== 'string' || typeof ip !== 'string')
    return null;
  if (!timingSafeEqual(digest(presented), digest(secret))) return null;
  const trimmed = ip.trim();
  return isIP(trimmed) ? trimmed : null;
}
