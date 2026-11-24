import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const apiRequest = vi.fn();
const startSession = vi.fn();
vi.mock('@/shared/api/server-api', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
vi.mock('@/features/auth/services/session.service', () => ({
  startSession: (...a: unknown[]) => startSession(...a),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { registerBusiness } = await import('./register.action');

const fields = {
  businessName: 'Tacos Ana',
  adminName: 'Ana',
  username: 'ana',
  password: 'segura-123',
  peyApiKey: 'pey_key_abcdef12',
};
const form = (over: Partial<typeof fields> = {}) => {
  const data = new FormData();
  for (const [k, v] of Object.entries({ ...fields, ...over })) data.set(k, v);
  return data;
};

describe('registerBusiness (Server Action)', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    startSession.mockReset();
  });

  it('registra el negocio, abre la sesión del admin y entra al panel', async () => {
    apiRequest.mockResolvedValue({ accessToken: 'jwt-admin', user: {}, business: {} });
    await expect(registerBusiness({}, form())).rejects.toThrow('NEXT_REDIRECT:/panel');
    expect(apiRequest).toHaveBeenCalledWith('/businesses', { method: 'POST', body: fields });
    expect(startSession).toHaveBeenCalledWith('jwt-admin');
  });

  it('con errores no llama a la API y nunca regresa la contraseña ni la API key', async () => {
    const state = await registerBusiness({}, form({ username: 'a' }));
    expect(state.fieldErrors?.username).toBeDefined();
    expect(state.values).toEqual({ businessName: 'Tacos Ana', adminName: 'Ana', username: 'a' });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('el rechazo de la API (API key inválida, usuario ocupado) se muestra tal cual', async () => {
    apiRequest.mockRejectedValue(new ApiError(409, 'Ese usuario ya existe'));
    const state = await registerBusiness({}, form());
    expect(state.formError).toBe('Ese usuario ya existe');
    expect(state.values).not.toHaveProperty('password');
    expect(state.values).not.toHaveProperty('peyApiKey');
  });
});
