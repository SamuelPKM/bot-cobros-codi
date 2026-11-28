import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, type ApiRequest, type ApiRequestOptions } from '@/shared/api/api-client';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import type { LoginInput } from '../policies/login-form.policy';
import { isTokenExpired } from '../policies/token-expiry.policy';
import { clearSession, loadSession, saveSession } from '../services/session-store';

/** Respuesta de POST /auth/login de la API. */
interface LoginResult {
  tokenType: 'Bearer';
  accessToken: string;
  user: PublicUser;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; token: string; user: PublicUser };

export interface Session {
  state: SessionState;
  signIn(input: LoginInput): Promise<void>;
  signOut(): Promise<void>;
  /** Llamada a la API con el token de la sesión; un 401 cierra la sesión. */
  authedRequest: ApiRequest;
  /** URL base de la API (para pedir imágenes con el token); vacía si no se conoce. */
  apiBaseUrl: string;
}

const SESSION_ENDED = 'Tu sesión terminó. Entra de nuevo.';

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  api,
  onSignOut,
  children,
}: {
  api: { request: ApiRequest; apiBaseUrl?: string };
  /** Antes de salir, con el token aún válido (p. ej. borrar el token de avisos push). */
  onSignOut?: (token: string) => Promise<void>;
  children: ReactNode;
}) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadSession().catch(() => null);
      if (cancelled) return;
      if (stored && !isTokenExpired(stored.token)) {
        setState({ status: 'signedIn', token: stored.token, user: stored.user });
        return;
      }
      if (stored) await clearSession().catch(() => undefined);
      if (!cancelled) setState({ status: 'signedOut' });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const result = await api.request<LoginResult>('/auth/login', { method: 'POST', body: input });
      const session = { token: result.accessToken, user: result.user };
      await saveSession(session);
      setState({ status: 'signedIn', ...session });
    },
    [api],
  );

  const token = state.status === 'signedIn' ? state.token : null;

  const signOut = useCallback(async () => {
    if (token && onSignOut) await onSignOut(token).catch(() => undefined);
    await clearSession().catch(() => undefined);
    setState({ status: 'signedOut' });
  }, [token, onSignOut]);

  const authedRequest = useCallback(
    async <T,>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
      try {
        return await api.request<T>(path, { ...options, token: token ?? undefined });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession().catch(() => undefined);
          setState({ status: 'signedOut', notice: SESSION_ENDED });
        }
        throw error;
      }
    },
    [api, token],
  ) as ApiRequest;

  const value = useMemo(
    () => ({ state, signIn, signOut, authedRequest, apiBaseUrl: api.apiBaseUrl ?? '' }),
    [state, signIn, signOut, authedRequest, api.apiBaseUrl],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession va dentro de <SessionProvider>');
  return session;
}

/** La persona con sesión; solo para pantallas detrás del guardia de sesión. */
export function useSignedInUser(): PublicUser {
  const { state } = useSession();
  if (state.status !== 'signedIn') throw new Error('Pantalla sin sesión');
  return state.user;
}
