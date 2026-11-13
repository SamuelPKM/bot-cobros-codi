import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Webhook } from 'standardwebhooks';
import { createMemoryStore } from '../src/store.js';
import { createApp } from '../src/webhook.js';

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const silentLog = { info() {}, warn() {}, error() {} };

// Payload de ejemplo de la documentación de pey (codi.pn.payment_received).
const paymentEvent = {
  amount: 0.01,
  apiKeyId: '01M3QMMR6X9CBVDY1SF3G8QWNW',
  concept: 'Prueba bot de cobros',
  datePaid: 1790724758,
  metadata: { trackingKey: '0192191042' },
  numRef: '0',
  transactionId: '01M3QR5E7XHXMNZDEPFH3JAWS0',
  type: 'codi.pn.payment_received',
};

function signedRequest(payload, { id = 'msg_1', timestamp = new Date(), secret = SECRET } = {}) {
  const body = JSON.stringify(payload);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign(id, timestamp, body),
    },
  };
}

describe('POST /webhooks/pey', () => {
  let server;
  let url;
  let store;
  let paid;
  let txResponse;
  let txCalls;

  before(async () => {
    const pey = {
      async getTransaction(id) {
        txCalls.push(id);
        if (txResponse instanceof Error) throw txResponse;
        return txResponse;
      },
    };
    // El almacén se cambia en cada prueba, así que la app lo consulta a través de este proxy.
    const storeProxy = new Proxy({}, { get: (_t, prop) => (...args) => store[prop](...args) });
    const app = createApp({
      webhookSecret: SECRET,
      pey,
      store: storeProxy,
      onPaid: (charge) => paid.push(charge),
      log: silentLog,
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    url = `http://127.0.0.1:${server.address().port}/webhooks/pey`;
  });

  after(() => server.close());

  beforeEach(() => {
    store = createMemoryStore();
    paid = [];
    txCalls = [];
    txResponse = { id: paymentEvent.transactionId, status: 'PAID', amount: 0.01, datePaid: 1790724758 };
  });

  const post = ({ body, headers }) => fetch(url, { method: 'POST', body, headers });

  it('acepta un pago con firma válida, lo confirma con la API y avisa una vez', async () => {
    store.saveCharge({ transactionId: paymentEvent.transactionId, amount: 0.01, concept: 'Prueba' });

    const res = await post(signedRequest(paymentEvent));

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, result: 'paid' });
    assert.deepEqual(txCalls, [paymentEvent.transactionId]);
    assert.equal(store.getCharge(paymentEvent.transactionId).status, 'paid');
    assert.equal(paid.length, 1);
    assert.equal(paid[0].trackingKey, '0192191042');
  });

  it('rechaza con 401 si el cuerpo fue alterado', async () => {
    const req = signedRequest(paymentEvent);
    req.body = req.body.replace('0.01', '9999');

    const res = await post(req);

    assert.equal(res.status, 401);
    assert.equal(txCalls.length, 0);
    assert.equal(paid.length, 0);
  });

  it('rechaza con 401 si se firmó con otro secreto', async () => {
    const res = await post(signedRequest(paymentEvent, { secret: 'whsec_b3Ryb3NlY3JldG9kaXN0aW50bw==' }));
    assert.equal(res.status, 401);
    assert.equal(paid.length, 0);
  });

  it('rechaza con 401 si el timestamp es viejo (ataque de repetición)', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const res = await post(signedRequest(paymentEvent, { timestamp: tenMinutesAgo }));
    assert.equal(res.status, 401);
    assert.equal(paid.length, 0);
  });

  it('rechaza con 401 si faltan los headers de firma', async () => {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(paymentEvent) });
    assert.equal(res.status, 401);
  });

  it('procesa una sola vez una entrega repetida (mismo webhook-id)', async () => {
    store.saveCharge({ transactionId: paymentEvent.transactionId, amount: 0.01 });

    const first = await post(signedRequest(paymentEvent, { id: 'msg_dup' }));
    const second = await post(signedRequest(paymentEvent, { id: 'msg_dup' }));

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).duplicate, true);
    assert.equal(txCalls.length, 1);
    assert.equal(paid.length, 1);
  });

  it('no avisa dos veces si llegan dos eventos distintos del mismo pago', async () => {
    store.saveCharge({ transactionId: paymentEvent.transactionId, amount: 0.01 });

    await post(signedRequest(paymentEvent, { id: 'msg_a' }));
    const second = await post(signedRequest(paymentEvent, { id: 'msg_b' }));

    assert.equal((await second.json()).result, 'already_paid');
    assert.equal(paid.length, 1);
  });

  it('responde 500 y no marca pagado si la API aún dice PENDING; el reintento sí lo procesa', async () => {
    store.saveCharge({ transactionId: paymentEvent.transactionId, amount: 0.01 });
    txResponse = { id: paymentEvent.transactionId, status: 'PENDING', amount: 0.01 };

    const first = await post(signedRequest(paymentEvent, { id: 'msg_retry' }));
    assert.equal(first.status, 500);
    assert.equal(store.getCharge(paymentEvent.transactionId).status, 'pending');
    assert.equal(paid.length, 0);

    txResponse = { id: paymentEvent.transactionId, status: 'PAID', amount: 0.01 };
    const retry = await post(signedRequest(paymentEvent, { id: 'msg_retry' }));
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).result, 'paid');
    assert.equal(paid.length, 1);
  });

  it('responde 500 si no se puede consultar la API de pey', async () => {
    txResponse = new Error('sin conexión');
    const res = await post(signedRequest(paymentEvent));
    assert.equal(res.status, 500);
    assert.equal(paid.length, 0);
  });

  it('no marca pagado si el monto confirmado no coincide con el cobro', async () => {
    store.saveCharge({ transactionId: paymentEvent.transactionId, amount: 150 });

    const res = await post(signedRequest(paymentEvent));

    assert.equal(res.status, 200);
    assert.equal((await res.json()).result, 'amount_mismatch');
    assert.equal(store.getCharge(paymentEvent.transactionId).status, 'pending');
    assert.equal(paid.length, 0);
  });

  it('ignora con 200 los tipos de evento que no son pagos', async () => {
    const res = await post(signedRequest({ type: 'bank.account.updated', codiStatus: 'ACTIVE' }));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).result, 'ignored');
    assert.equal(txCalls.length, 0);
  });
});
