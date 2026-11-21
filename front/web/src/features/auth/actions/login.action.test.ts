import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const apiRequest = vi.fn();
const startSession = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock('@/shared/api/server-api', () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }));
vi.mock('../services/session.service', () => ({
  startSession: (...args: unknown[]) => startSession(...args),
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

const { login } = await import('./login.action');

const form = (username: string, password: string) => {
  const data = new FormData();
  data.set('username', username);
  data.set('password', password);
  return data;
};

describe('login (Server Action)', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    startSession.mockReset();
    redirect.mockClear();
  });

  it('con datos incompletos no llama a la API y devuelve los errores', async () => {
    const state = await login({}, form('', ''));
    expect(state.fieldErrors).toEqual({ username: 'Escribe tu usuario', password: 'Escribe tu contraseña' });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('con credenciales correctas guarda la sesión y entra al panel', async () => {
    apiRequest.mockResolvedValue({ tokenType: 'Bearer', accessToken: 'jwt-ana', user: { id: 1 } });
    await expect(login({}, form('ana', 'ana-12345'))).rejects.toThrow('NEXT_REDIRECT:/panel');
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { username: 'ana', password: 'ana-12345' },
    });
    expect(startSession).toHaveBeenCalledWith('jwt-ana');
  });

  it('credenciales equivocadas: mensaje general y conserva el usuario escrito', async () => {
    apiRequest.mockRejectedValue(new ApiError(401, 'Usuario o contraseña incorrectos'));
    const state = await login({}, form('ana', 'mala'));
    expect(state).toEqual({ formError: 'Usuario o contraseña incorrectos', username: 'ana' });
    expect(startSession).not.toHaveBeenCalled();
  });

  it('cuenta desactivada o API caída: muestra el mensaje de la API', async () => {
    apiRequest.mockRejectedValue(new ApiError(403, 'Tu cuenta está desactivada. Habla con el administrador'));
    expect((await login({}, form('ana', 'x'))).formError).toMatch(/desactivada/);
  });

  it('un error inesperado no se le muestra tal cual', async () => {
    apiRequest.mockRejectedValue(new Error('boom interno'));
    expect((await login({}, form('ana', 'x'))).formError).toBe(
      'Algo salió mal. Intenta de nuevo en un momento.',
    );
  });
});
