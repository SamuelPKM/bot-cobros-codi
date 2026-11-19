// Demo web pública de punta a punta: servidor real, bot real, pey simulado.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createBot } from '../src/bot.js';
import { createCharges } from '../src/charges.js';
import { createOutbox } from '../src/outbox.js';
import { fakePey, freshStore, silentLog } from './helpers.js';

const DEMO = { merchantName: 'Negocio <de> prueba' };
const LIMITS = { maxAmountCents: 100, maxChargesPerHour: 10, maxPushesPerPayerPerHour: 3 };

describe('demo web', () => {
  let server;
  let base;
  const state = {};

  before(async () => {
    const proxy = (key) => new Proxy({}, { get: (_t, prop) => (...args) => state[key][prop](...args) });
    const app = createApp({
      peyWebhookSecret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
      pey: proxy('pey'),
      store: proxy('store'),
      demo: {
        onMessage: (message) => state.bot.handleMessage(message),
        merchantName: DEMO.merchantName,
        maxAmount: '1.00',
      },
      log: silentLog,
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  beforeEach(async () => {
    state.store = await freshStore();
    state.pey = fakePey();
    const outbox = createOutbox({ store: state.store, log: silentLog });
    state.charges = createCharges({
      store: state.store,
      pey: state.pey,
      outbox,
      limits: LIMITS,
      publicBaseUrl: 'https://bot.example.com',
      renderQr: async () => Buffer.from('png-falso'),
      log: silentLog,
    });
    state.bot = createBot({ store: state.store, charges: state.charges, outbox, demo: DEMO, log: silentLog });
  });

  async function newSession() {
    const res = await fetch(`${base}/demo/api/session`, { method: 'POST' });
    assert.equal(res.status, 201);
    return (await res.json()).sessionId;
  }

  const send = (session, text, after = 0) =>
    fetch(`${base}/demo/api/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-demo-session': session },
      body: JSON.stringify({ text, after }),
    });

  const read = async (session, after = 0) =>
    (await (await fetch(`${base}/demo/api/messages?after=${after}`, { headers: { 'x-demo-session': session } })).json())
      .messages;

  it('sirve la página con el nombre del negocio escapado y una CSP estricta', async () => {
    const res = await fetch(`${base}/demo`);
    const html = await res.text();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(html, /Negocio &lt;de&gt; prueba/);
    assert.doesNotMatch(html, /Negocio <de> prueba/);
    assert.match(html, /El máximo es de \$1\.00/);
  });

  it('la raíz redirige a la demo', async () => {
    const res = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/demo');
  });

  it('una sesión nueva empieza con la bienvenida', async () => {
    const session = await newSession();
    const messages = await read(session);

    assert.match(session, /^[a-f0-9]{32}$/);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].sender, 'bot');
    assert.match(messages[0].body, /cobra 0\.01 a <tu celular> prueba/);
  });

  it('cobro por push completo: borrador, confirmación y aviso de pago en la conversación', async () => {
    const session = await newSession();

    let res = await send(session, 'cobra 0.01 a 5512345678 prueba', 1);
    let messages = (await res.json()).messages;
    assert.deepEqual(messages.map((m) => m.sender), ['user', 'bot']);
    assert.match(messages[1].body, /Vas a cobrar \$0\.01 al 55 1234 5678/);

    res = await send(session, 'sí', messages.at(-1).id);
    messages = (await res.json()).messages;
    assert.match(messages.at(-1).body, /Listo, envié el cobro/);
    assert.equal(state.pey.pushes[0].concept, 'Negocio <de> prueba: prueba');

    // Llega el pago (como lo haría el webhook) y el aviso aparece en la conversación.
    const charge = await state.store.getChargeByTransactionId('TX1');
    await state.store.markPaid(charge.id, { paidVia: 'push' });
    await state.charges.notifyPaid(await state.store.getCharge(charge.id));
    const later = await read(session, messages.at(-1).id);
    assert.match(later.at(-1).body, /✅ Pagado: \$0\.01 al 55 1234 5678/);
  });

  it('el QR llega como imagen en la conversación', async () => {
    const session = await newSession();
    const messages = (await (await send(session, 'qr 0.01 prueba', 1)).json()).messages;

    const qr = messages.at(-1);
    assert.equal(qr.image, `data:image/png;base64,${Buffer.from('png-falso').toString('base64')}`);
    assert.match(qr.body, /QR para cobrar \$0\.01/);
  });

  it('respeta el monto máximo de la demo', async () => {
    const session = await newSession();
    const messages = (await (await send(session, 'liga 50 prueba', 1)).json()).messages;

    assert.match(messages.at(-1).body, /el monto máximo es de \$1\.00/);
    assert.equal(state.pey.links.length, 0);
  });

  it('cada sesión ve solo su conversación', async () => {
    const a = await newSession();
    const b = await newSession();
    await send(a, 'resumen');

    assert.equal((await read(a)).length, 3);
    assert.equal((await read(b)).length, 1);
  });

  it('rechaza con 401 una sesión inexistente o mal formada', async () => {
    const fake = 'a'.repeat(32);
    assert.equal((await send(fake, 'hola')).status, 401);
    assert.equal((await send('../../etc', 'hola')).status, 401);
    assert.equal((await fetch(`${base}/demo/api/messages`)).status, 401);
  });

  it('rechaza mensajes vacíos o demasiado largos', async () => {
    const session = await newSession();
    assert.equal((await send(session, '   ')).status, 400);
    assert.equal((await send(session, 'x'.repeat(301))).status, 400);
  });

  it('limita los mensajes por sesión', async () => {
    const session = await newSession();
    const statuses = [];
    for (let i = 0; i < 31; i += 1) statuses.push((await send(session, 'ayuda')).status);

    assert.equal(statuses.filter((s) => s === 200).length, 30);
    assert.equal(statuses.at(-1), 429);
  });

  it('limita las sesiones nuevas por IP', async () => {
    const statuses = [];
    for (let i = 0; i < 21; i += 1) statuses.push((await fetch(`${base}/demo/api/session`, { method: 'POST' })).status);
    assert.equal(statuses.at(-1), 429);
  });
});
