import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const apiRequest = vi.fn();
const sessionToken = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock('@/shared/api/server-api', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
vi.mock('./session.service', () => ({ sessionToken: () => sessionToken() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

const { getCurrentUser } = await import('./current-user.service');

describe('getCurrentUser', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    sessionToken.mockReset();
  });

  it('sin sesión manda a Entrar', async () => {
    sessionToken.mockResolvedValue(null);
    await expect(getCurrentUser()).rejects.toThrow('NEXT_REDIRECT:/entrar');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('pregunta a la API quién es, con el token de la sesión', async () => {
    sessionToken.mockResolvedValue('jwt-ana');
    apiRequest.mockResolvedValue({ user: { id: 1, name: 'Ana' } });
    await expect(getCurrentUser()).resolves.toEqual({ id: 1, name: 'Ana' });
    expect(apiRequest).toHaveBeenCalledWith('/me', { token: 'jwt-ana' });
  });

  it('token vencido o cuenta desactivada: manda a Entrar', async () => {
    sessionToken.mockResolvedValue('jwt-viejo');
    apiRequest.mockRejectedValue(new ApiError(401, 'Sesión vencida'));
    await expect(getCurrentUser()).rejects.toThrow('NEXT_REDIRECT:/entrar');
    apiRequest.mockRejectedValue(new ApiError(403, 'Desactivada'));
    await expect(getCurrentUser()).rejects.toThrow('NEXT_REDIRECT:/entrar');
  });

  it('si la API está caída no oculta el error', async () => {
    sessionToken.mockResolvedValue('jwt-ana');
    apiRequest.mockRejectedValue(new ApiError(503, 'No pudimos conectar'));
    await expect(getCurrentUser()).rejects.toThrow('No pudimos conectar');
  });
});
