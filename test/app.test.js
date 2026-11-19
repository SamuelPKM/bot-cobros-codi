import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Webhook } from 'standardwebhooks';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { PeyError } from '../src/pey.js';
import { fakePey, silentLog } from './helpers.js';

const PEY_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const META_APP_SECRET = 'secreto-de-la-app-de-meta';
const VERIFY_TOKEN = 'token-de-verificacion';

function peyRequest(payload, { id = 'msg_1', timestamp = new Date(), secret = PEY_SECRET } = {}) {
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

function whatsappRequest(messages, { secret = META_APP_SECRET } = {}) {
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', messages } }] }],
  });
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
    },
  };
}

const textMessage = (id, body, from = '5215511112222') => ({ id, from, type: 'text', text: { body } });

describe('servidor', () => {
  let server;
  let base;
  // Estado que cada prueba reinicia; la app lo alcanza a través de estas referencias.
  const state = {};

  before(async () => {
    const app = createApp({
      peyWebhookSecret: PEY_SECRET,
      pey: new Proxy({}, { get: (_t, prop) => (...args) => state.pey[prop](...args) }),
      db: new Proxy({}, { get: (_t, prop) => (...args) => state.db[prop](...args) }),
      onPaid: async (charge) => {
        if (state.onPaidFails) throw new Error('WhatsApp caído');
        state.paid.push(charge);
      },
      whatsapp: {
        appSecret: META_APP_SECRET,
        verifyToken: VERIFY_TOKEN,
        onMessage: async (message) => {
          state.messages.push(message);
          if (state.onMessageFails) throw new Error('falló el bot');
        },
      },
      log: silentLog,
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  beforeEach(() => {
    state.db = openDb(':memory:');
    state.pey = fakePey();
    state.paid = [];
    state.messages = [];
    state.onPaidFails = false;
    state.onMessageFails = false;
  });

  const post = (path, { body, headers }) => fetch(`${base}${path}`, { method: 'POST', body, headers });

  /** Crea un cobro ya enviado por push, como lo dejaría el bot. */
  async function pendingCharge(amount = 150) {
    const charge = state.db.createCharge({
      merchantPhone: '5511112222',
      merchantWaId: '5215511112222',
      payerPhone: '5512345678',
      amountCents: Math.round(amount * 100),
      concept: 'corte',
      status: 'sending',
    });
    const { transactionId } = await state.pey.createPush({ amount, metadata: { chargeId: String(charge.id) } });
    return state.db.updateCharge(charge.id, { status: 'pending', transactionId });
  }

  const pushPaidEvent = (transactionId, amount = 150) => ({
    amount,
    apiKeyId: '01M3QMMR6X9CBVDY1SF3G8QWNW',
    concept: 'Barbería Leo: corte',
    datePaid: 1790724758,
    metadata: { trackingKey: 'RASTREO1' },
    numRef: '1',
    transactionId,
    type: 'codi.pn.payment_received',
  });

  describe('POST /webhooks/pey: firma', () => {
    it('rechaza con 401 un cuerpo alterado', async () => {
      const charge = await pendingCharge();
      state.pey.pay(charge.transactionId);
      const req = peyRequest(pushPaidEvent(charge.transactionId));
      req.body = req.body.replace('150', '1');

      const res = await post('/webhooks/pey', req);

      assert.equal(res.status, 401);
      assert.equal(state.db.getCharge(charge.id).status, 'pending');
    });

    it('rechaza con 401 otro secreto, un timestamp viejo y la falta de headers', async () => {
      const event = pushPaidEvent('TX1');
      const otherSecret = await post('/webhooks/pey', peyRequest(event, { secret: 'whsec_b3Ryb3NlY3JldG9kaXN0aW50bw==' }));
      const old = await post('/webhooks/pey', peyRequest(event, { timestamp: new Date(Date.now() - 10 * 60 * 1000) }));
      const bare = await fetch(`${base}/webhooks/pey`, { method: 'POST', body: JSON.stringify(event) });

      assert.deepEqual([otherSecret.status, old.status, bare.status], [401, 401, 401]);
      assert.equal(state.paid.length, 0);
    });
  });

  describe('POST /webhooks/pey: pago de un push', () => {
    it('confirma con la API, marca pagado y avisa', async () => {
      const charge = await pendingCharge();
      state.pey.pay(charge.transactionId);

      const res = await post('/webhooks/pey', peyRequest(pushPaidEvent(charge.transactionId)));

      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true, result: 'paid' });
      const paid = state.db.getCharge(charge.id);
      assert.equal(paid.status, 'paid');
      assert.equal(paid.paidVia, 'push');
      assert.equal(paid.trackingKey, 'RASTREO1');
      assert.equal(state.paid.length, 1);
    });

    it('liga el pago por metadata.chargeId si nunca supimos el transactionId', async () => {
      const charge = await pendingCharge();
      const { transactionId } = charge;
      state.db.updateCharge(charge.id, { status: 'unknown', transactionId: null });
      state.pey.pay(transactionId);

      const res = await post('/webhooks/pey', peyRequest(pushPaidEvent(transactionId)));

      assert.equal((await res.json()).result, 'paid');
      const paid = state.db.getCharge(charge.id);
      assert.equal(paid.status, 'paid');
      assert.equal(paid.transactionId, transactionId);
    });

    it('procesa una sola vez una entrega repetida', async () => {
      const charge = await pendingCharge();
      state.pey.pay(charge.transactionId);
      const event = pushPaidEvent(charge.transactionId);

      await post('/webhooks/pey', peyRequest(event, { id: 'msg_dup' }));
      const second = await post('/webhooks/pey', peyRequest(event, { id: 'msg_dup' }));

      assert.equal((await second.json()).duplicate, true);
      assert.equal(state.paid.length, 1);
    });

    it('responde 500 si la API aún dice PENDING, y el reintento sí lo procesa', async () => {
      const charge = await pendingCharge();
      const event = pushPaidEvent(charge.transactionId);

      const first = await post('/webhooks/pey', peyRequest(event, { id: 'msg_retry' }));
      assert.equal(first.status, 500);
      assert.equal(state.db.getCharge(charge.id).status, 'pending');

      state.pey.pay(charge.transactionId);
      const retry = await post('/webhooks/pey', peyRequest(event, { id: 'msg_retry' }));
      assert.equal((await retry.json()).result, 'paid');
    });

    it('responde 500 si no se puede consultar la API', async () => {
      const charge = await pendingCharge();
      state.pey.fail = new PeyError('timeout', { type: 'TIMEOUT' });

      const res = await post('/webhooks/pey', peyRequest(pushPaidEvent(charge.transactionId)));

      assert.equal(res.status, 500);
      assert.equal(state.db.getCharge(charge.id).status, 'pending');
    });

    it('si el aviso al comerciante falla responde 500, y el reintento avisa sin volver a marcar', async () => {
      const charge = await pendingCharge();
      state.pey.pay(charge.transactionId);
      const event = pushPaidEvent(charge.transactionId);

      state.onPaidFails = true;
      const first = await post('/webhooks/pey', peyRequest(event, { id: 'msg_notify' }));
      assert.equal(first.status, 500);
      assert.equal(state.db.getCharge(charge.id).status, 'paid'); // el pago sí quedó registrado

      state.onPaidFails = false;
      const retry = await post('/webhooks/pey', peyRequest(event, { id: 'msg_notify' }));
      assert.equal((await retry.json()).result, 'already_paid');
      assert.equal(state.paid.length, 1);
    });

    it('no marca pagado si el monto confirmado no coincide', async () => {
      const charge = await pendingCharge(150);
      state.pey.pay(charge.transactionId);
      state.pey.transactions.get(charge.transactionId).amount = 1;

      const res = await post('/webhooks/pey', peyRequest(pushPaidEvent(charge.transactionId, 1)));

      assert.equal((await res.json()).result, 'amount_mismatch');
      assert.equal(state.db.getCharge(charge.id).status, 'pending');
      assert.equal(state.paid.length, 0);
    });

    it('responde 200 sin hacer nada si el pago no corresponde a ningún cobro', async () => {
      const { transactionId } = await state.pey.createPush({ amount: 5, metadata: {} });
      state.pey.pay(transactionId);

      const res = await post('/webhooks/pey', peyRequest(pushPaidEvent(transactionId, 5)));

      assert.equal(res.status, 200);
      assert.equal((await res.json()).result, 'unknown_charge');
    });

    it('ignora con 200 los eventos que no son pagos', async () => {
      const res = await post('/webhooks/pey', peyRequest({ type: 'bank.account.updated', codiStatus: 'ACTIVE' }));
      assert.equal((await res.json()).result, 'ignored');
    });
  });

  describe('POST /webhooks/pey: pago de un QR', () => {
    async function qrCharge(amount = 150) {
      const charge = state.db.createCharge({
        kind: 'qr',
        merchantPhone: '5511112222',
        merchantWaId: '5215511112222',
        amountCents: Math.round(amount * 100),
        concept: 'corte',
        status: 'creating',
      });
      const qr = await state.pey.createQr({ amount, metadata: { chargeId: String(charge.id) } });
      return state.db.updateCharge(charge.id, { status: 'qr', qrId: qr.id });
    }

    const qrPaidEvent = (codiQrId, transactionId, amount = 150) => ({
      amount,
      apiKeyId: '01M3QMMR6X9CBVDY1SF3G8QWNW',
      codiQrId,
      concept: 'Barbería Leo: corte',
      datePaid: 1790725000,
      metadata: {},
      numRef: '1',
      transactionId,
      type: 'codi.qr.payment_received',
    });

    it('liga el pago al cobro por el id del QR y lo marca pagado por QR', async () => {
      const charge = await qrCharge();
      const transactionId = state.pey.payQr(charge.qrId);

      const res = await post('/webhooks/pey', peyRequest(qrPaidEvent(charge.qrId, transactionId)));

      assert.equal((await res.json()).result, 'paid');
      const paid = state.db.getCharge(charge.id);
      assert.equal(paid.status, 'paid');
      assert.equal(paid.paidVia, 'qr');
      assert.equal(paid.transactionId, transactionId);
      assert.equal(paid.trackingKey, 'RASTREOQR');
      assert.equal(state.paid.length, 1);
    });

    it('un segundo pago al mismo QR se registra como pago de más, sin avisar otra vez', async () => {
      const charge = await qrCharge();
      const first = state.pey.payQr(charge.qrId);
      await post('/webhooks/pey', peyRequest(qrPaidEvent(charge.qrId, first), { id: 'msg_q1' }));

      const second = state.pey.payQr(charge.qrId);
      const res = await post('/webhooks/pey', peyRequest(qrPaidEvent(charge.qrId, second), { id: 'msg_q2' }));

      assert.equal((await res.json()).result, 'extra_payment');
      assert.equal(state.db.getCharge(charge.id).transactionId, first);
      assert.equal(state.paid.length, 1);
    });

    it('no marca pagado si el monto del QR no coincide', async () => {
      const charge = await qrCharge(150);
      const transactionId = state.pey.payQr(charge.qrId);
      state.pey.transactions.get(transactionId).amountBreakdown.base = 1;

      const res = await post('/webhooks/pey', peyRequest(qrPaidEvent(charge.qrId, transactionId, 1)));

      assert.equal((await res.json()).result, 'amount_mismatch');
      assert.equal(state.db.getCharge(charge.id).status, 'qr');
    });
  });

  describe('POST /webhooks/pey: liga de pago', () => {
    async function chargeWithLink(amount = 150) {
      const charge = state.db.createCharge({
        merchantPhone: '5511112222',
        merchantWaId: '5215511112222',
        payerPhone: '5512345678',
        amountCents: amount * 100,
        status: 'expired',
      });
      const { id, url } = await state.pey.createPaymentLink({ amount, clientReferenceId: `cobro-${charge.id}` });
      return state.db.updateCharge(charge.id, { status: 'link', linkId: id, linkUrl: url });
    }

    const linkEvent = (paymentLinkId, status = 'paid') => ({
      apiKeyId: '01HXYZ1234567890ABCDEFGH',
      type: 'payment_link.status_updated',
      paymentLinkId,
      status,
    });

    it('marca pagado el cobro cuando la liga queda pagada; la propina no cuenta como diferencia', async () => {
      const charge = await chargeWithLink(150);
      state.pey.payLink(charge.linkId, { tip: 20 });

      const res = await post('/webhooks/pey', peyRequest(linkEvent(charge.linkId)));

      assert.equal((await res.json()).result, 'paid');
      const paid = state.db.getCharge(charge.id);
      assert.equal(paid.status, 'paid');
      assert.equal(paid.paidVia, 'link');
      assert.equal(state.paid.length, 1);
    });

    it('no hace nada mientras la liga está pending o processing', async () => {
      const charge = await chargeWithLink();
      const res = await post('/webhooks/pey', peyRequest(linkEvent(charge.linkId, 'processing')));

      assert.equal((await res.json()).result, 'link_processing');
      assert.equal(state.db.getCharge(charge.id).status, 'link');
    });

    it('responde 500 si el webhook dice paid pero la API todavía no', async () => {
      const charge = await chargeWithLink();
      const res = await post('/webhooks/pey', peyRequest(linkEvent(charge.linkId)));

      assert.equal(res.status, 500);
      assert.equal(state.db.getCharge(charge.id).status, 'link');
    });
  });

  describe('GET /webhooks/whatsapp: verificación de Meta', () => {
    it('devuelve el challenge si el token coincide', async () => {
      const res = await fetch(
        `${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1158201444`,
      );
      assert.equal(res.status, 200);
      assert.equal(await res.text(), '1158201444');
    });

    it('responde 403 si el token no coincide', async () => {
      const res = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`);
      assert.equal(res.status, 403);
    });
  });

  describe('POST /webhooks/whatsapp', () => {
    it('entrega al bot los mensajes de texto con firma válida', async () => {
      const res = await post('/webhooks/whatsapp', whatsappRequest([textMessage('wamid.1', 'cobra 150 a 5512345678 corte')]));

      assert.equal(res.status, 200);
      assert.deepEqual(state.messages, [
        { id: 'wamid.1', from: '5215511112222', type: 'text', text: 'cobra 150 a 5512345678 corte' },
      ]);
    });

    it('rechaza con 401 una firma inválida o ausente', async () => {
      const message = [textMessage('wamid.1', 'sí')];
      const wrong = await post('/webhooks/whatsapp', whatsappRequest(message, { secret: 'otro-secreto' }));
      const missing = await fetch(`${base}/webhooks/whatsapp`, { method: 'POST', body: whatsappRequest(message).body });

      assert.deepEqual([wrong.status, missing.status], [401, 401]);
      assert.equal(state.messages.length, 0);
    });

    it('nunca ejecuta dos veces el mismo mensaje, aunque Meta lo reenvíe', async () => {
      const req = whatsappRequest([textMessage('wamid.dup', 'sí')]);
      await post('/webhooks/whatsapp', req);
      await post('/webhooks/whatsapp', req);

      assert.equal(state.messages.length, 1);
    });

    it('si el bot falla responde 200 y no reintenta el mensaje', async () => {
      state.onMessageFails = true;
      const req = whatsappRequest([textMessage('wamid.err', 'sí')]);

      const first = await post('/webhooks/whatsapp', req);
      const second = await post('/webhooks/whatsapp', req);

      assert.deepEqual([first.status, second.status], [200, 200]);
      assert.equal(state.messages.length, 1);
    });

    it('marca como no-texto las imágenes y pasa por alto los avisos de estado', async () => {
      const image = { id: 'wamid.img', from: '5215511112222', type: 'image', image: { id: 'MEDIA' } };
      await post('/webhooks/whatsapp', whatsappRequest([image]));
      assert.deepEqual(state.messages, [{ id: 'wamid.img', from: '5215511112222', type: 'image', text: null }]);

      const statusOnly = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.x', status: 'delivered' }] } }] }] });
      const res = await post('/webhooks/whatsapp', {
        body: statusOnly,
        headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', META_APP_SECRET).update(statusOnly).digest('hex')}` },
      });
      assert.equal(res.status, 200);
      assert.equal(state.messages.length, 1);
    });
  });

  it('las páginas de regreso de la liga no afirman que ya se pagó', async () => {
    const thanks = await (await fetch(`${base}/pago/gracias`)).text();
    const cancelled = await (await fetch(`${base}/pago/cancelado`)).text();
    assert.match(thanks, /Estamos confirmando tu pago/);
    assert.match(cancelled, /No se realizó ningún cargo/);
  });
});
