import 'server-only';
import { cookies } from 'next/headers';
import { isProduction } from '@/shared/config/server-env';
import { DEFAULT_SESSION_SECONDS, SESSION_COOKIE } from '../constants/session.constants';
import { secondsUntilExpiry } from '../policies/token-expiry.policy';

/** Guarda el token de la API en la cookie de sesión (solo en Server Actions o Route Handlers). */
export async function startSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntilExpiry(token) ?? DEFAULT_SESSION_SECONDS,
  });
}

/** El token de la sesión actual, o null si no hay. */
export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
