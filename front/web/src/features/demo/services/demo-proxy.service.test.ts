import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-client';

const apiRequest = vi.fn();
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock('@/shared/api/server-api', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('@/features/charges/services/qr-image.service', () => ({
  qrDataUrl: async (qr: string) => `data:image/png;base64,QR(${qr})`,
}));

const { startDemo, demoMessages, sendDemoMessage } = await import('./demo-proxy.service');

const SESSION = 'a'.repeat(32);
const bot = (id: number, text: string, extra = {}) => ({ id, sender: 'bot', text, createdAt: 'x', ...extra });

describe('demo-proxy.service', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    for (const fn of Object.values(cookieStore)) fn.mockReset();
  });

  it('startDemo abre la sesión en la API y la guarda en una cookie httpOnly', async () => {
    apiRequest.mockResolvedValue({ sessionId: SESSION, messages: [bot(1, 'Hola')] });
    await expect(startDemo()).resolves.toEqual({
      ok: true,
      messages: [{ id: 1, sender: 'bot', text: 'Hola' }],
    });
    expect(apiRequest).toHaveBeenCalledWith('/demo/sessions', { method: 'POST' });
    expect(cookieStore.set).toHaveBeenCalledWith(
      'cobrale_demo',
      SESSION,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 24 * 60 * 60 }),
    );
  });

  it('demoMessages pide lo nuevo con la sesión y dibuja los QR en el servidor', async () => {
    cookieStore.get.mockReturnValue({ value: SESSION });
    apiRequest.mockResolvedValue({
      messages: [bot(5, 'QR para cobrar', { qrString: 'CODI' }), bot(6, 'liga', { url: 'https://pey.test/l' })],
    });
    await expect(demoMessages(4)).resolves.toEqual({
      ok: true,
      messages: [
        { id: 5, sender: 'bot', text: 'QR para cobrar', qrImage: 'data:image/png;base64,QR(CODI)' },
        { id: 6, sender: 'bot', text: 'liga', url: 'https://pey.test/l' },
      ],
    });
    expect(apiRequest).toHaveBeenCalledWith('/demo/messages?after=4', {
      headers: { 'x-demo-session': SESSION },
    });
  });

  it('sin cookie o con la sesión vencida: 401 y se borra la cookie', async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(demoMessages(0)).resolves.toEqual({ ok: false, status: 401, error: expect.any(String) });
    expect(apiRequest).not.toHaveBeenCalled();

    cookieStore.get.mockReturnValue({ value: SESSION });
    apiRequest.mockRejectedValue(new ApiError(401, 'Sesión de demo inválida o vencida'));
    await expect(demoMessages(0)).resolves.toMatchObject({ ok: false, status: 401 });
    expect(cookieStore.delete).toHaveBeenCalledWith('cobrale_demo');
  });

  it('sendDemoMessage manda el texto y respeta los límites de la API', async () => {
    cookieStore.get.mockReturnValue({ value: SESSION });
    apiRequest.mockResolvedValue({ messages: [] });
    await sendDemoMessage('qr 1', 7);
    expect(apiRequest).toHaveBeenCalledWith('/demo/messages', {
      method: 'POST',
      body: { text: 'qr 1', after: 7 },
      headers: { 'x-demo-session': SESSION },
    });

    apiRequest.mockRejectedValue(new ApiError(429, 'Vas muy rápido. Espera unos minutos.'));
    await expect(sendDemoMessage('hola', 7)).resolves.toEqual({
      ok: false,
      status: 429,
      error: 'Vas muy rápido. Espera unos minutos.',
    });
  });

  it('rechaza mensajes vacíos o largos sin llamar a la API', async () => {
    cookieStore.get.mockReturnValue({ value: SESSION });
    await expect(sendDemoMessage('   ', 0)).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(sendDemoMessage('x'.repeat(301), 0)).resolves.toMatchObject({ ok: false, status: 400 });
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
