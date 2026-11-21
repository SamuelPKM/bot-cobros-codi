// Server Actions de Ajustes: el negocio (admin) y el WhatsApp de cada persona.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';
import { createServerMocks, formOf, redirectThrows } from '../../test/mocks/server-mocks';

const m = createServerMocks();
vi.mock('@/features/auth/services/authed-api.service', () => ({
  authedRequest: (...a: unknown[]) => m.authedRequest(...a),
}));
vi.mock('next/cache', () => ({ refresh: () => m.refresh() }));
vi.mock('next/navigation', () => ({ redirect: redirectThrows }));

const { updateBusiness } = await import('./businesses/actions/update-business.action');
const { createLinkCode, unlinkWhatsApp } = await import('./whatsapp/actions/whatsapp-link.action');

describe('updateBusiness', () => {
  beforeEach(() => m.reset());

  it('guarda solo la sección enviada y refresca', async () => {
    m.authedRequest.mockResolvedValue({ business: {} });
    const state = await updateBusiness({}, formOf({ section: 'webhook', peyWebhookSecret: 'whsec_abcdefgh123' }));
    expect(m.authedRequest).toHaveBeenCalledWith('/businesses/me', {
      method: 'PATCH',
      body: { peyWebhookSecret: 'whsec_abcdefgh123' },
    });
    expect(state).toEqual({ notice: 'Listo, guardado.' });
    expect(m.refresh).toHaveBeenCalled();
  });

  it('no regresa la API key ni el secreto aunque falle', async () => {
    m.authedRequest.mockRejectedValue(new ApiError(422, 'pey rechazó esa API key'));
    const state = await updateBusiness({}, formOf({ section: 'apiKey', peyApiKey: 'pey_mala_12345' }));
    expect(state).toEqual({ formError: 'pey rechazó esa API key' });
  });

  it('valida antes de llamar a la API', async () => {
    const state = await updateBusiness({}, formOf({ section: 'name', name: '' }));
    expect(state.fieldErrors?.name).toBeDefined();
    expect(m.authedRequest).not.toHaveBeenCalled();
  });
});

describe('WhatsApp', () => {
  beforeEach(() => m.reset());

  it('crea el código para ligar el número', async () => {
    m.authedRequest.mockResolvedValue({ code: '123456', message: 'vincular 123456', expiresAt: '2026-12-01T18:10:00Z' });
    await expect(createLinkCode()).resolves.toEqual({
      code: { code: '123456', message: 'vincular 123456', expiresAt: '2026-12-01T18:10:00Z' },
    });
    expect(m.authedRequest).toHaveBeenCalledWith('/me/whatsapp/link-code', { method: 'POST' });
  });

  it('desliga el número', async () => {
    m.authedRequest.mockResolvedValue(null);
    await unlinkWhatsApp();
    expect(m.authedRequest).toHaveBeenCalledWith('/me/whatsapp', { method: 'DELETE' });
    expect(m.refresh).toHaveBeenCalled();
  });
});
