/** Margen para no mandar un token que vence a medio camino. */
const SKEW_SECONDS = 60;

/**
 * Lee el `exp` del JWT de la API (sin verificar la firma: eso lo hace la API
 * en cada llamada). Si no se puede leer, lo da por vencido.
 */
export function isTokenExpired(token: string, now = new Date()): boolean {
  const payload = token.split('.')[1];
  if (!payload) return true;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(base64)) as { exp?: unknown };
    if (typeof exp !== 'number') return true;
    return exp - now.getTime() / 1000 < SKEW_SECONDS;
  } catch {
    return true;
  }
}
