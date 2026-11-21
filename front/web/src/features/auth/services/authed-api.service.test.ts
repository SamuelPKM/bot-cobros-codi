import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const apiRequest = vi.fn();
const sessionToken = vi.fn();
vi.mock('@/shared/api/server-api', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
vi.mock('./session.service', () => ({ sessionToken: () => sessionToken() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { authedRequest } = await import('./authed-api.service');

describe('authedRequest', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    sessionToken.mockReset();
  });

  it('agrega el token de la sesión a la petición', async () => {
    sessionToken.mockResolvedValue('jwt-1');
    apiRequest.mockResolvedValue({ charges: [] });
    await expect(authedRequest('/charges', { method: 'GET' })).resolves.toEqual({ charges: [] });
    expect(apiRequest).toHaveBeenCalledWith('/charges', { method: 'GET', token: 'jwt-1' });
  });

  it('sin sesión o con el token vencido manda a Entrar', async () => {
    sessionToken.mockResolvedValue(null);
    await expect(authedRequest('/charges')).rejects.toThrow('NEXT_REDIRECT:/entrar');
    sessionToken.mockResolvedValue('jwt-viejo');
    apiRequest.mockRejectedValue(new ApiError(401, 'vencido'));
    await expect(authedRequest('/charges')).rejects.toThrow('NEXT_REDIRECT:/entrar');
  });

  it('otros errores (403 de permisos, 422…) se los deja a quien llama', async () => {
    sessionToken.mockResolvedValue('jwt-1');
    apiRequest.mockRejectedValue(new ApiError(422, 'Tu monto máximo por cobro es de $100.00'));
    await expect(authedRequest('/charges')).rejects.toMatchObject({ status: 422 });
  });
});
