import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const authedRequest = vi.fn();
const refresh = vi.fn();
vi.mock('@/features/auth/services/authed-api.service', () => ({
  authedRequest: (...a: unknown[]) => authedRequest(...a),
}));
vi.mock('next/cache', () => ({ refresh: () => refresh() }));

const { showFallback } = await import('./charge-fallback.action');

const form = (chargeId: string, kind: string) => {
  const data = new FormData();
  data.set('chargeId', chargeId);
  data.set('kind', kind);
  return data;
};

describe('showFallback (Server Action)', () => {
  beforeEach(() => {
    authedRequest.mockReset();
    refresh.mockReset();
  });

  it('pide el QR o la liga del mismo cobro y refresca la pantalla', async () => {
    authedRequest.mockResolvedValue({});
    await expect(showFallback({}, form('7', 'qr'))).resolves.toEqual({});
    expect(authedRequest).toHaveBeenCalledWith('/charges/7/qr', { method: 'POST' });
    await showFallback({}, form('7', 'link'));
    expect(authedRequest).toHaveBeenLastCalledWith('/charges/7/link', { method: 'POST' });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('ignora datos manipulados', async () => {
    expect((await showFallback({}, form('abc', 'qr'))).formError).toBeDefined();
    expect((await showFallback({}, form('7', 'push'))).formError).toBeDefined();
    expect(authedRequest).not.toHaveBeenCalled();
  });

  it('si el cobro ya no está pendiente lo explica', async () => {
    authedRequest.mockRejectedValue(new ApiError(409, 'Este cobro ya no está pendiente'));
    expect(await showFallback({}, form('7', 'qr'))).toEqual({
      formError: 'Este cobro ya no está pendiente',
    });
  });
});
