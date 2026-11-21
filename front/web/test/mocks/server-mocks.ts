import { vi } from 'vitest';

/**
 * Dobles de lo que usan las Server Actions: la API con sesión, la cookie y la
 * navegación de Next. Se registran con vi.mock en cada prueba:
 *
 *   vi.mock('@/features/auth/services/authed-api.service', () => mocks.authedApi);
 */
export function createServerMocks() {
  const authedRequest = vi.fn();
  const apiRequest = vi.fn();
  const startSession = vi.fn();
  const refresh = vi.fn();
  return {
    authedRequest,
    apiRequest,
    startSession,
    refresh,
    reset() {
      for (const fn of [authedRequest, apiRequest, startSession, refresh]) fn.mockReset();
    },
  };
}

/** redirect() de Next lanza; así se ve en las pruebas. */
export const redirectThrows = (url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
};

export const formOf = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
