import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPeyClient, PeyError, toCents } from '../src/pey.js';

function fakeFetch(status, json) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(json), { status });
  };
  return { fetchImpl, calls };
}

describe('cliente de pey', () => {
  it('createPush manda POST /codi/pn con Bearer y el cuerpo esperado', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { transactionId: '01TX', codiId: '12345678901234567890' });
    const pey = createPeyClient({ apiKey: 'llave-de-prueba', fetchImpl });

    const result = await pey.createPush({ amount: 0.01, phoneNumber: '5512345678', concept: 'Prueba', expiration: 360 });

    assert.deepEqual(result, { transactionId: '01TX', codiId: '12345678901234567890' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.pey.mx/codi/pn');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer llave-de-prueba');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      amount: 0.01,
      phoneNumber: '5512345678',
      concept: 'Prueba',
      expiration: 360,
    });
  });

  it('valida antes de llamar: teléfono, monto, expiración y numRef', async () => {
    const { fetchImpl, calls } = fakeFetch(200, {});
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });
    const ok = { amount: 1, phoneNumber: '5512345678' };

    await assert.rejects(pey.createPush({ ...ok, phoneNumber: '+525512345678' }), { type: 'INVALID_PARAMETER' });
    await assert.rejects(pey.createPush({ ...ok, amount: 0 }), { type: 'INVALID_AMOUNT' });
    await assert.rejects(pey.createPush({ ...ok, amount: 1_000_001 }), { type: 'INVALID_AMOUNT' });
    await assert.rejects(pey.createPush({ ...ok, expiration: 359 }), { type: 'INVALID_PARAMETER' });
    await assert.rejects(pey.createPush({ ...ok, numRef: '12345678' }), { type: 'INVALID_PARAMETER' });
    assert.equal(calls.length, 0);
  });

  it('convierte el sobre de error de pey en PeyError con type y requestId', async () => {
    const { fetchImpl } = fakeFetch(400, {
      error: { message: 'account is not active', type: 'INVALID_STATE', requestId: 'req-123' },
    });
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });

    await assert.rejects(pey.createPush({ amount: 1, phoneNumber: '5512345678' }), (error) => {
      assert.ok(error instanceof PeyError);
      assert.equal(error.status, 400);
      assert.equal(error.type, 'INVALID_STATE');
      assert.equal(error.requestId, 'req-123');
      return true;
    });
  });

  it('no reintenta un POST cuando falla la red', async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      throw new TypeError('fetch failed');
    };
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });

    await assert.rejects(pey.createPush({ amount: 1, phoneNumber: '5512345678' }), { type: 'NETWORK_ERROR' });
    assert.equal(attempts, 1);
  });

  it('getTransaction consulta GET /transaction/{id}', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { id: '01TX', status: 'PAID', amount: 0.01 });
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });

    const tx = await pey.getTransaction('01TX');

    assert.equal(tx.status, 'PAID');
    assert.equal(calls[0].url, 'https://api.pey.mx/transaction/01TX');
    assert.equal(calls[0].init.method, 'GET');
  });

  it('toCents compara montos sin errores de punto flotante', () => {
    assert.equal(toCents(0.01), 1);
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents(150), 15000);
  });
});
