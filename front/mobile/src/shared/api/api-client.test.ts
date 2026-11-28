import { ApiError, createApiClient } from './api-client';

const json = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  }) as Response;

const headersOf = (fetch: jest.Mock, call = 0) => fetch.mock.calls[call][1].headers as Record<string, string>;

describe('createApiClient', () => {
  it('llama a la API con JSON y el Bearer token', async () => {
    const fetch = jest.fn().mockResolvedValue(json(200, { ok: true }));
    const api = createApiClient({ baseUrl: 'https://api.test/', fetch });

    await expect(
      api.request('/charges', { method: 'POST', body: { amount: 10 }, token: 'jwt-1' }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test/charges');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"amount":10}');
    expect(headersOf(fetch)).toMatchObject({
      authorization: 'Bearer jwt-1',
      'content-type': 'application/json',
      accept: 'application/json',
    });
  });

  it('sin token no manda Authorization; GET sin cuerpo', async () => {
    const fetch = jest.fn().mockResolvedValue(json(200, []));
    await createApiClient({ baseUrl: 'https://api.test', fetch }).request('/health');
    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(headersOf(fetch)).not.toHaveProperty('authorization');
    expect(headersOf(fetch)).not.toHaveProperty('content-type');
  });

  it('204 devuelve null', async () => {
    const fetch = jest.fn().mockResolvedValue({ status: 204, ok: true } as Response);
    await expect(
      createApiClient({ baseUrl: 'https://api.test', fetch }).request('/x', { method: 'DELETE' }),
    ).resolves.toBeNull();
  });

  it('un error de Nest se vuelve ApiError con su estado y mensaje', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(json(422, { statusCode: 422, message: ['Falta el monto', 'Falta el celular'] }));
    const error = await createApiClient({ baseUrl: 'https://api.test', fetch })
      .request('/charges')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, message: 'Falta el monto. Falta el celular' });
  });

  it('un error sin mensaje legible da uno genérico', async () => {
    const fetch = jest.fn().mockResolvedValue({
      status: 502,
      ok: false,
      json: () => Promise.reject(new SyntaxError('no es JSON')),
    } as Response);
    await expect(
      createApiClient({ baseUrl: 'https://api.test', fetch }).request('/me'),
    ).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/Algo salió mal/) });
  });

  it('sin conexión: ApiError 503 con un mensaje para la persona', async () => {
    const fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(
      createApiClient({ baseUrl: 'https://api.test', fetch }).request('/me'),
    ).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/No pudimos conectar/) });
  });

  describe('si la API tarda demasiado', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    const hanging = () =>
      jest.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          }),
      );

    it('corta la llamada y lo dice', async () => {
      const fetch = hanging();
      const pending = createApiClient({ baseUrl: 'https://api.test', fetch, timeoutMs: 1000 })
        .request('/charges')
        .catch((e: unknown) => e);
      jest.advanceTimersByTime(1000);
      await expect(pending).resolves.toMatchObject({
        status: 504,
        message: expect.stringMatching(/tardó demasiado/),
      });
    });

    it('en un POST avisa que pudo haberse hecho, para no cobrar dos veces', async () => {
      const fetch = hanging();
      const pending = createApiClient({ baseUrl: 'https://api.test', fetch, timeoutMs: 1000 })
        .request('/charges', { method: 'POST', body: { amount: 1 } })
        .catch((e: unknown) => e);
      jest.advanceTimersByTime(1000);
      await expect(pending).resolves.toMatchObject({
        status: 504,
        message: expect.stringMatching(/Revisa tus cobros antes de intentar de nuevo/),
      });
    });
  });
});
