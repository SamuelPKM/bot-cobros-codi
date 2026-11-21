import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createApiClient', () => {
  it('llama a la API con JSON y el Bearer token', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { ok: true }));
    const api = createApiClient({ baseUrl: 'https://api.test/', fetch });

    await expect(
      api.request('/charges', { method: 'POST', body: { amount: 10 }, token: 'jwt-1' }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test/charges');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"amount":10}');
    expect(init.cache).toBe('no-store');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer jwt-1');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('sin token no manda Authorization; GET sin cuerpo', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    await createApiClient({ baseUrl: 'https://api.test', fetch }).request('/demo');
    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('authorization')).toBe(false);
  });

  it('204 devuelve null', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      createApiClient({ baseUrl: 'https://api.test', fetch }).request('/x', { method: 'DELETE' }),
    ).resolves.toBeNull();
  });

  it('un error de Nest se vuelve ApiError con su estado y mensaje', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(422, { statusCode: 422, message: ['Falta el monto', 'Falta el celular'] }));
    const error = await createApiClient({ baseUrl: 'https://api.test', fetch })
      .request('/charges')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, message: 'Falta el monto. Falta el celular' });
  });

  it('si la API no responde, ApiError 503 con un mensaje para la persona', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      createApiClient({ baseUrl: 'https://api.test', fetch }).request('/me'),
    ).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/No pudimos conectar/) });
  });
});
