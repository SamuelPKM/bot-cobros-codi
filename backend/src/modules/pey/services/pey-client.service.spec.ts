import { PeyError } from '../errors/pey.error';
import { PeyClient } from './pey-client.service';

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetch = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const client = (fetch: typeof globalThis.fetch) =>
  new PeyClient({
    apiKey: 'llave-de-prueba',
    baseUrl: 'https://api.pey.mx',
    fetch,
  });

const okPush = { amount: 1, phoneNumber: '5512345678' };

describe('PeyClient', () => {
  describe('createPush', () => {
    it('manda POST /codi/pn con Bearer y solo los campos definidos', async () => {
      const { fetch, calls } = fakeFetch(200, {
        transactionId: '01TX',
        codiId: '12345678901234567890',
      });

      const result = await client(fetch).createPush({
        amount: 0.01,
        phoneNumber: '5512345678',
        concept: 'Prueba',
        expiration: 360,
        numRef: '42',
        metadata: { chargeId: '7' },
      });

      expect(result).toEqual({
        transactionId: '01TX',
        codiId: '12345678901234567890',
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('https://api.pey.mx/codi/pn');
      expect(calls[0].init.method).toBe('POST');
      expect(calls[0].init.headers).toMatchObject({
        Authorization: 'Bearer llave-de-prueba',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        amount: 0.01,
        phoneNumber: '5512345678',
        concept: 'Prueba',
        expiration: 360,
        numRef: '42',
        metadata: { chargeId: '7' },
      });
    });

    it('no manda campos opcionales vacíos', async () => {
      const { fetch, calls } = fakeFetch(200, {
        transactionId: 'T',
        codiId: 'C',
      });
      await client(fetch).createPush(okPush);
      expect(JSON.parse(calls[0].init.body as string)).toEqual(okPush);
    });

    it.each([
      [
        'teléfono con +52',
        { ...okPush, phoneNumber: '+525512345678' },
        'INVALID_PARAMETER',
      ],
      [
        'teléfono de 9 dígitos',
        { ...okPush, phoneNumber: '551234567' },
        'INVALID_PARAMETER',
      ],
      ['monto 0', { ...okPush, amount: 0 }, 'INVALID_AMOUNT'],
      [
        'monto mayor a 1,000,000',
        { ...okPush, amount: 1_000_001 },
        'INVALID_AMOUNT',
      ],
      ['monto con 3 decimales', { ...okPush, amount: 1.234 }, 'INVALID_AMOUNT'],
      ['monto NaN', { ...okPush, amount: Number.NaN }, 'INVALID_AMOUNT'],
      [
        'expiración menor a 360 s',
        { ...okPush, expiration: 359 },
        'INVALID_PARAMETER',
      ],
      [
        'expiración no entera',
        { ...okPush, expiration: 400.5 },
        'INVALID_PARAMETER',
      ],
      [
        'numRef de 8 dígitos',
        { ...okPush, numRef: '12345678' },
        'INVALID_PARAMETER',
      ],
      ['numRef con letras', { ...okPush, numRef: '12a' }, 'INVALID_PARAMETER'],
    ])('rechaza %s sin llamar a pey', async (_case, input, type) => {
      const { fetch, calls } = fakeFetch(200, {});
      await expect(client(fetch).createPush(input)).rejects.toMatchObject({
        type,
      });
      expect(calls).toHaveLength(0);
    });
  });

  describe('createQr', () => {
    it('manda POST /codi/qr con expiración obligatoria y sin imagen por defecto', async () => {
      const { fetch, calls } = fakeFetch(201, {
        id: 'IDC1',
        qrString: '{"TYP":1}',
      });

      const result = await client(fetch).createQr({
        amount: 150,
        concept: 'Tacos',
        expiration: 900,
        numRef: '7',
        metadata: { chargeId: '7' },
      });

      expect(result).toEqual({ id: 'IDC1', qrString: '{"TYP":1}' });
      expect(calls[0].url).toBe('https://api.pey.mx/codi/qr');
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        amount: 150,
        concept: 'Tacos',
        expiration: 900,
        numRef: '7',
        metadata: { chargeId: '7' },
        generateImage: false,
      });
    });

    it('nunca crea un QR sin expiración (podría cobrarse varias veces)', async () => {
      const { fetch, calls } = fakeFetch(201, {});
      await expect(
        client(fetch).createQr({ amount: 1, expiration: 0 }),
      ).rejects.toMatchObject({
        type: 'INVALID_PARAMETER',
      });
      expect(calls).toHaveLength(0);
    });

    it('no acepta monto 0 (el pagador elegiría cuánto pagar)', async () => {
      const { fetch } = fakeFetch(201, {});
      await expect(
        client(fetch).createQr({ amount: 0, expiration: 900 }),
      ).rejects.toMatchObject({
        type: 'INVALID_AMOUNT',
      });
    });
  });

  describe('ligas de pago', () => {
    const link = {
      amount: 150,
      successUrl: 'https://cobrale.app/pago/gracias',
      backUrl: 'https://cobrale.app/pago/cancelado',
      clientReferenceId: 'cobro-7',
      metadata: { chargeId: '7' },
    };

    it('createPaymentLink manda POST /payment-link/create sin propina', async () => {
      const { fetch, calls } = fakeFetch(200, {
        id: 'LINK1',
        url: 'https://app.mipey.mx/payment-link/LINK1',
      });
      await expect(client(fetch).createPaymentLink(link)).resolves.toEqual({
        id: 'LINK1',
        url: 'https://app.mipey.mx/payment-link/LINK1',
      });
      expect(calls[0].url).toBe('https://api.pey.mx/payment-link/create');
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        ...link,
        hasTip: false,
      });
    });

    it.each([
      [
        'un regreso que no es https',
        { ...link, successUrl: 'http://cobrale.app/ok' },
        'INVALID_PARAMETER',
      ],
      ['monto 0', { ...link, amount: 0 }, 'INVALID_AMOUNT'],
    ])('rechaza %s sin llamar a pey', async (_case, input, type) => {
      const { fetch, calls } = fakeFetch(200, {});
      await expect(
        client(fetch).createPaymentLink(input),
      ).rejects.toMatchObject({ type });
      expect(calls).toHaveLength(0);
    });

    it('getPaymentLink consulta GET /payment-link/{id}', async () => {
      const { fetch, calls } = fakeFetch(200, {
        id: 'LINK1',
        status: 'paid',
        transactions: [],
      });
      const res = await client(fetch).getPaymentLink('LINK1');
      expect(res.status).toBe('paid');
      expect(calls[0].url).toBe('https://api.pey.mx/payment-link/LINK1');
    });
  });

  describe('verifyApiKey', () => {
    it('consulta GET /transaction/api-key para comprobar que la key sirve', async () => {
      const { fetch, calls } = fakeFetch(200, { items: [], nextToken: null });
      await expect(client(fetch).verifyApiKey()).resolves.toBeUndefined();
      expect(calls[0].url).toBe('https://api.pey.mx/transaction/api-key');
      expect(calls[0].init.method).toBe('GET');
    });

    it('lanza PeyError con status 401 si pey no reconoce la key', async () => {
      const { fetch } = fakeFetch(401, {
        error: { message: 'Unauthorized', type: 'UNAUTHORIZED' },
      });
      await expect(client(fetch).verifyApiKey()).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('consultas', () => {
    it('getTransaction consulta GET /transaction/{id} con el id escapado', async () => {
      const { fetch, calls } = fakeFetch(200, {
        id: 'a/b',
        status: 'PAID',
        amount: 0.01,
      });
      const tx = await client(fetch).getTransaction('a/b');
      expect(tx.status).toBe('PAID');
      expect(calls[0].url).toBe('https://api.pey.mx/transaction/a%2Fb');
      expect(calls[0].init.method).toBe('GET');
      expect(calls[0].init.body).toBeUndefined();
    });

    it('listQrTransactions devuelve los pagos de un QR', async () => {
      const { fetch, calls } = fakeFetch(200, {
        items: [{ id: 'TX1', status: 'PAID' }],
      });
      await expect(client(fetch).listQrTransactions('IDC1')).resolves.toEqual([
        { id: 'TX1', status: 'PAID' },
      ]);
      expect(calls[0].url).toBe('https://api.pey.mx/transaction/codi/qr/IDC1');
    });

    it('listQrTransactions devuelve [] si pey no manda items', async () => {
      const { fetch } = fakeFetch(200, {});
      await expect(client(fetch).listQrTransactions('IDC1')).resolves.toEqual(
        [],
      );
    });
  });

  describe('errores', () => {
    it('convierte el sobre de error de pey en PeyError con status, type y requestId', async () => {
      const { fetch } = fakeFetch(400, {
        error: {
          message: 'account is not active',
          type: 'INVALID_STATE',
          requestId: 'req-123',
        },
      });
      const promise = client(fetch).createPush(okPush);
      await expect(promise).rejects.toBeInstanceOf(PeyError);
      await expect(promise).rejects.toMatchObject({
        message: 'account is not active',
        status: 400,
        type: 'INVALID_STATE',
        requestId: 'req-123',
      });
    });

    it('un error sin sobre queda como UNKNOWN con el código HTTP', async () => {
      const { fetch } = fakeFetch(503, 'Service Unavailable');
      await expect(client(fetch).getTransaction('T')).rejects.toMatchObject({
        status: 503,
        type: 'UNKNOWN',
      });
    });

    it('una respuesta 200 que no es JSON es INVALID_RESPONSE', async () => {
      const { fetch } = fakeFetch(200, '<html>');
      await expect(client(fetch).getTransaction('T')).rejects.toMatchObject({
        type: 'INVALID_RESPONSE',
      });
    });

    it('no reintenta un POST cuando falla la red', async () => {
      const fetch = jest.fn(() =>
        Promise.reject(new TypeError('fetch failed')),
      );
      await expect(
        client(fetch as unknown as typeof globalThis.fetch).createPush(okPush),
      ).rejects.toMatchObject({ type: 'NETWORK_ERROR' });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('marca TIMEOUT cuando pey tarda demasiado, para tratar el cobro como "no se sabe"', async () => {
      const fetch = jest.fn((_url: string, init: RequestInit) => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return Promise.reject(new DOMException('timeout', 'TimeoutError'));
      });
      await expect(
        client(fetch as unknown as typeof globalThis.fetch).createPush(okPush),
      ).rejects.toMatchObject({ type: 'TIMEOUT' });
    });
  });
});
