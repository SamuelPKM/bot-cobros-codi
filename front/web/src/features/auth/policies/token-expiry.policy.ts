/**
 * Segundos que le quedan al JWT de la API, leyendo su `exp` (sin verificar la
 * firma: eso lo hace la API en cada petición). Sirve para que la cookie dure
 * lo mismo que el token. null si no se puede leer.
 */
export function secondsUntilExpiry(token: string, now = new Date()): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    if (typeof exp !== 'number') return null;
    return Math.max(0, Math.floor(exp - now.getTime() / 1000));
  } catch {
    return null;
  }
}
