// Cuenta de pey propia de un negocio: el asistente de la web, el cifrado, los
// cobros con su API key y su webhook, aislado de la cuenta del proyecto.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Webhook } from 'standardwebhooks';
import { createApp } from '../src/app.js';
import { createCharges } from '../src/charges.js';
import { createPeyAccounts } from '../src/pey-accounts.js';
import { createSecretBox } from '../src/secrets.js';
import { mountWeb } from '../src/web/routes.js';
import { fakePey, fakeWhatsApp, freshStore, silentLog } from './helpers.js';

const LIMITS = { maxAmountCents: 100, maxChargesPerHour: 10, maxPushesPerPayerPerHour: 3 };
const PLATFORM_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const OWN_SECRET = 'whsec_b3Ryb3NlY3JldG9kaXN0aW50bzEyMzQ=';
const OWN_KEY = 'sk_live_negocio_leo_0123456789abcdef';
const BASE_URL = 'https://cobrale.example.com';

describe('secretos cifrados', () => {
  it('abre lo que sella, y nada con otra llave o si se altera', () => {
    const box = createSecretBox('x'.repeat(40));
    const sealed = box.seal('sk_live_secreto');
    assert.doesNotMatch(sealed, /sk_live/);
    assert.notEqual(box.seal('sk_live_secreto'), sealed); // IV distinto cada vez
    assert.equal(box.open(sealed), 'sk_live_secreto');
    assert.equal(createSecretBox('y'.repeat(40)).open(sealed), null);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    assert.equal(box.open(tampered), null);
    assert.equal(box.open('basura'), null);
  });

  it('exige una llave larga', () => {
    assert.throws(() => createSecretBox('corta'), /32 caracteres/);
  });
});

function browser(base) {
  let cookie = '';
  const request = async (path, { method = 'GET', form = null, body = null, headers = {} } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: { ...(cookie ? { cookie } : {}), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...headers },
      body: form ? new URLSearchParams(form).toString() : body,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, location: res.headers.get('location'), text: await res.text() };
  };
  return {
    get: (path) => request(path),
    post: (path, form) => request(path, { method: 'POST', form }),
    raw: request,
    async csrf(path = '/panel/ajustes') {
      return /name="_csrf" value="([^"]+)"/.exec((await request(path)).text)?.[1];
    },
  };
}

function signed(payload, secret, id) {
  const body = JSON.stringify(payload);
  const ts = new Date();
  return {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(ts.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign(id, ts, body),
    },
  };
}

describe('cuenta de pey propia', () => {
  let server;
  let base;
  const state = {};

  before(async () => {
    const proxy = (key) => new Proxy({}, { get: (_t, prop) => (...args) => state[key][prop](...args) });
    const app = createApp({
      peyWebhookSecret: PLATFORM_SECRET,
      pey: proxy('platform'),
      peyAccounts: proxy('accounts'),
      store: proxy('store'),
      onPaid: (charge) => state.charges.notifyPaid(charge),
      log: silentLog,
      web: (target) =>
        mountWeb(target, {
          store: proxy('store'),
          charges: proxy('charges'),
          peyAccounts: new Proxy({}, { get: (_t, prop) => (typeof state.accounts[prop] === 'function' ? (...a) => state.accounts[prop](...a) : state.accounts[prop]) }),
          limits: LIMITS,
          publicBaseUrl: BASE_URL,
          log: silentLog,
        }),
    });
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  beforeEach(async () => {
    state.store = await freshStore();
    state.platform = fakePey();
    state.own = fakePey(); // lo que hay detrás de la API key del negocio
    state.keysUsed = [];
    state.accounts = createPeyAccounts({
      store: state.store,
      platform: state.platform,
      makeClient: (apiKey) => {
        state.keysUsed.push(apiKey);
        return state.own;
      },
      secrets: createSecretBox('llave-de-pruebas-con-mas-de-32-caracteres'),
      publicBaseUrl: BASE_URL,
      log: silentLog,
    });
    state.charges = createCharges({
      store: state.store,
      pey: state.platform,
      peyAccounts: state.accounts,
      outbox: fakeWhatsApp(),
      limits: LIMITS,
      publicBaseUrl: BASE_URL,
      renderQr: async () => Buffer.from('png'),
      log: silentLog,
    });
  });

  async function signup(email = 'leo@example.com') {
    const b = browser(base);
    const res = await b.post('/registro', { negocio: 'Barbería Leo', nombre: 'Leo', correo: email, contrasena: 'una-clave-larga' });
    assert.equal(res.status, 303);
    return b;
  }

  /** Conecta la cuenta con el asistente y devuelve la ruta del webhook propio. */
  async function connect(b) {
    const csrf = await b.csrf();
    assert.equal((await b.post('/panel/ajustes/pey/llave', { llave: OWN_KEY, _csrf: csrf })).location, '/panel/ajustes?ok=peyLlave#pey');
    const page = (await b.get('/panel/ajustes')).text;
    const url = /id="pey-webhook-url"|value="(https:\/\/cobrale\.example\.com\/webhooks\/pey\/n\/[^"]+)"/.exec(page.match(/value="https:\/\/cobrale\.example\.com\/webhooks\/pey\/n\/[^"]+"/)[0])[1];
    assert.equal((await b.post('/panel/ajustes/pey/webhook', { secreto: OWN_SECRET, _csrf: csrf })).location, '/panel/ajustes?ok=peyConectada#pey');
    return new URL(url).pathname;
  }

  it('el asistente guía, valida la API key y la guarda cifrada', async () => {
    const b = await signup();
    let page = (await b.get('/panel/ajustes')).text;
    assert.match(page, /Tu propia cuenta de pey/);
    assert.match(page, /portal\.mipey\.mx/);
    assert.match(page, /Crear API Key/);

    // Una llave que pey no reconoce no se guarda.
    state.own.rejectKey = true;
    const bad = await b.post('/panel/ajustes/pey/llave', { llave: 'sk_live_mala_0123456789', _csrf: await b.csrf() });
    assert.equal(bad.status, 422);
    assert.match(bad.text, /pey no reconoció esa API key/);
    state.own.rejectKey = false;

    await b.post('/panel/ajustes/pey/llave', { llave: OWN_KEY, _csrf: await b.csrf() });
    page = (await b.get('/panel/ajustes')).text;
    assert.match(page, /termina en <strong>cdef<\/strong>/);
    assert.match(page, /webhooks\/pey\/n\//);
    assert.doesNotMatch(page, new RegExp(OWN_KEY));

    const [row] = await state.store.db.query('SELECT pey_key_sealed FROM merchants');
    assert.doesNotMatch(row.pey_key_sealed, /sk_live/);

    // Un secreto mal copiado se rechaza.
    const wrong = await b.post('/panel/ajustes/pey/webhook', { secreto: 'no-es-secreto', _csrf: await b.csrf() });
    assert.match(wrong.text, /empieza con whsec_/);
  });

  it('hasta conectar el webhook, los cobros siguen por la cuenta del proyecto', async () => {
    const b = await signup();
    await b.post('/panel/ajustes/pey/llave', { llave: OWN_KEY, _csrf: await b.csrf() });
    await b.post('/panel/cobros', { tipo: 'qr', monto: '0.50', _csrf: await b.csrf('/panel') });
    assert.equal(state.platform.qrs.length, 1);
    assert.equal(state.own.qrs.length, 0);
  });

  it('conectada: cobra con su API key, sin modo prueba, y su webhook marca el pago', async () => {
    const b = await signup();
    const hook = await connect(b);
    const panel = (await b.get('/panel')).text;
    assert.doesNotMatch(panel, /Modo prueba/);

    // $50 pasaría el límite de $1.00 del modo prueba.
    await b.post('/panel/cobros', { tipo: 'qr', monto: '50', concepto: 'corte', _csrf: await b.csrf('/panel') });
    await b.post('/panel/cobros', { tipo: 'link', monto: '80', _csrf: await b.csrf('/panel') });
    assert.equal(state.own.qrs.length, 1);
    assert.equal(state.own.links.length, 1);
    assert.equal(state.platform.qrs.length + state.platform.links.length, 0);
    assert.equal(state.own.qrs[0].bankAccountId, undefined);
    assert.ok(state.keysUsed.includes(OWN_KEY));
    assert.equal((await state.store.getCharge(1)).peyMerchantId, 1);

    const transactionId = state.own.payQr('IDC1');
    const res = await fetch(
      `${base}${hook}`,
      signed({ type: 'codi.qr.payment_received', transactionId, codiQrId: 'IDC1', amount: 50 }, OWN_SECRET, 'evt_1'),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).result, 'paid');
    assert.equal((await state.store.getCharge(1)).status, 'paid');
    assert.match((await b.get('/panel/ajustes')).text, /Último aviso de pey<\/dt><dd>(?!Todavía)/);
  });

  it('cada cuenta solo marca sus propios cobros', async () => {
    // Ana cobra con la cuenta del proyecto; Leo con la suya.
    const ana = await signup('ana@example.com');
    await ana.post('/panel/cobros', { tipo: 'qr', monto: '0.50', _csrf: await ana.csrf('/panel') });
    const leo = await signup('leo@example.com');
    const hook = await connect(leo);
    state.own.qrs.push({}); // en pey los id de QR nunca se repiten entre cuentas: este será IDC2
    await leo.post('/panel/cobros', { tipo: 'qr', monto: '0.50', _csrf: await leo.csrf('/panel') });
    assert.equal((await state.store.getCharge(2)).qrId, 'IDC2');

    // Un pago real en la cuenta de Leo que dice ser del cobro de Ana (metadata
    // y monto iguales) no lo marca pagado.
    const forged = state.own.payQr('IDC2');
    const leoTx = await state.own.getTransaction(forged);
    leoTx.metadata = { externalMetadata: { chargeId: '1' } };
    const viaLeo = await fetch(`${base}${hook}`, signed({ type: 'codi.qr.payment_received', transactionId: forged, amount: 0.5 }, OWN_SECRET, 'evt_a'));
    assert.equal((await viaLeo.json()).result, 'other_account');
    assert.equal((await state.store.getCharge(1)).status, 'qr');

    // Y el webhook del proyecto no marca los cobros de la cuenta de Leo.
    const platformTx = state.platform.payQr('IDC1');
    state.platform.transactions.get(platformTx).metadata = { externalMetadata: { chargeId: '2' } };
    const viaPlatform = await fetch(
      `${base}/webhooks/pey`,
      signed({ type: 'codi.qr.payment_received', transactionId: platformTx, amount: 0.5 }, PLATFORM_SECRET, 'evt_b'),
    );
    assert.equal((await viaPlatform.json()).result, 'other_account');
    assert.equal((await state.store.getCharge(2)).status, 'qr');
  });

  it('el webhook propio rechaza otra firma y una URL desconocida', async () => {
    const b = await signup();
    const hook = await connect(b);
    const bad = await fetch(`${base}${hook}`, signed({ type: 'codi.qr.payment_received' }, PLATFORM_SECRET, 'evt_x'));
    assert.equal(bad.status, 401);
    const unknown = await fetch(`${base}/webhooks/pey/n/no-existe-este-token-de-nadie`, signed({}, OWN_SECRET, 'evt_y'));
    assert.equal(unknown.status, 404);
  });

  it('al vencer, el barrido consulta con la API key del negocio', async () => {
    const b = await signup();
    await connect(b);
    await b.post('/panel/cobros', { tipo: 'qr', monto: '5', _csrf: await b.csrf('/panel') });
    state.own.payQr('IDC1');
    await state.store.updateCharge(1, { expiresAt: 0 });
    await state.charges.sweep();
    assert.equal((await state.store.getCharge(1)).status, 'paid');
  });

  it('no se desconecta con cobros en espera; después sí, y vuelve el modo prueba', async () => {
    const b = await signup();
    await connect(b);
    await b.post('/panel/cobros', { tipo: 'qr', monto: '5', _csrf: await b.csrf('/panel') });
    const blocked = await b.post('/panel/ajustes/pey/desconectar', { _csrf: await b.csrf() });
    assert.equal(blocked.status, 422);
    assert.match(blocked.text, /cobros en espera/);

    await state.store.transition(1, 'qr', 'expired');
    assert.equal((await b.post('/panel/ajustes/pey/desconectar', { _csrf: await b.csrf() })).location, '/panel/ajustes?ok=peyDesconectada#pey');
    const [row] = await state.store.db.query('SELECT pey_key_sealed, pey_webhook_token FROM merchants');
    assert.equal(row.pey_key_sealed, null);
    assert.equal(row.pey_webhook_token, null);
    assert.match((await b.get('/panel')).text, /Modo prueba/);
  });

  it('un vendedor no puede conectar ni desconectar la cuenta', async () => {
    const leo = await signup();
    const invite = await leo.post('/panel/equipo', { nombre: 'Ana', correo: 'ana@example.com', rol: 'seller', _csrf: await leo.csrf('/panel/equipo') });
    const path = new URL(/value="(https:[^"]+\/invitacion\/[^"]+)"/.exec(invite.text)[1]).pathname;
    const ana = browser(base);
    await ana.post(path, { nombre: 'Ana', contrasena: 'clave-de-ana-123' });
    const csrf = await ana.csrf();
    assert.equal((await ana.post('/panel/ajustes/pey/llave', { llave: OWN_KEY, _csrf: csrf })).status, 403);
    assert.equal((await ana.post('/panel/ajustes/pey/desconectar', { _csrf: csrf })).status, 403);
    assert.doesNotMatch((await ana.get('/panel/ajustes')).text, /name="llave"/);
  });

  it('sin SECRETS_KEY el asistente lo explica y no guarda nada', async () => {
    state.accounts = createPeyAccounts({
      store: state.store,
      platform: state.platform,
      makeClient: () => state.own,
      secrets: null,
      publicBaseUrl: BASE_URL,
      log: silentLog,
    });
    const b = await signup();
    assert.match((await b.get('/panel/ajustes')).text, /falta <code>SECRETS_KEY<\/code>/);
    const res = await b.post('/panel/ajustes/pey/llave', { llave: OWN_KEY, _csrf: await b.csrf() });
    assert.equal(res.status, 422);
  });
});
