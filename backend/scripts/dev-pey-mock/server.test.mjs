import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { Webhook } = createRequire(import.meta.url)('standardwebhooks');
const SECRET = `whsec_${Buffer.from('secreto-ficticio-de-prueba').toString('base64')}`;
const KEY = { Authorization: 'Bearer llave-ficticia-123' };

let receiver, mock, base;
const received = [];

const listen = (srv) =>
  new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

before(async () => {
  receiver = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
      res.end('{"ok":true}');
    });
  });
  const receiverPort = await listen(receiver);

  const probe = createServer();
  const port = await listen(probe);
  await new Promise((ok) => probe.close(ok));

  base = `http://127.0.0.1:${port}`;
  mock = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MOCK_PORT: String(port),
      MOCK_WEBHOOK_SECRET: SECRET,
      MOCK_WEBHOOK_URL: `http://127.0.0.1:${receiverPort}/hook`,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok, fail) => {
    mock.once('exit', (code) => fail(new Error(`el simulador salió con ${code}`)));
    mock.stdout.on('data', (d) => String(d).includes('escuchando') && ok());
  });
});

after(() => {
  mock?.kill();
  receiver?.close();
});

const call = (method, path, body, headers = KEY) =>
  fetch(base + path, {
    method,
    headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

test('sin API key responde 401 con el formato de error de pey', async () => {
  const res = await call('GET', '/transaction/api-key', undefined, {});
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.type, 'UNAUTHORIZED');
  assert.equal((await call('GET', '/transaction/api-key')).status, 200);
});

test('crea un push, lo paga y manda un webhook con firma válida', async () => {
  const created = await call('POST', '/codi/pn', {
    amount: 125.5,
    phoneNumber: '5512345678',
    concept: 'Prueba',
    metadata: { chargeId: 7 },
  });
  assert.equal(created.status, 200);
  const { transactionId, codiId } = await created.json();
  assert.match(codiId, /^\d{20}$/);

  const pending = await (await call('GET', `/transaction/${transactionId}`)).json();
  assert.equal(pending.status, 'PENDING');

  const paid = await call('POST', `/__dev/pay/${transactionId}`);
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).webhook.ok, true);

  assert.equal(received.length, 1);
  const { headers, body } = received[0];
  const event = new Webhook(SECRET).verify(body, {
    'webhook-id': headers['webhook-id'],
    'webhook-timestamp': headers['webhook-timestamp'],
    'webhook-signature': headers['webhook-signature'],
  });
  assert.equal(event.type, 'codi.pn.payment_received');
  assert.equal(event.transactionId, transactionId);
  assert.equal(event.metadata.externalMetadata.chargeId, 7);

  const tx = await (await call('GET', `/transaction/${transactionId}`)).json();
  assert.equal(tx.status, 'PAID');
  assert.equal(tx.amountBreakdown.base, 125.5);
});

test('liga y QR: se consultan y se pagan', async () => {
  const link = await (
    await call('POST', '/payment-link/create', {
      amount: 10,
      successUrl: 'https://x.test/ok',
      backUrl: 'https://x.test/no',
      clientReferenceId: 'cobro-9',
    })
  ).json();
  assert.match(link.url, /\/pagar\/lnk_/);
  assert.equal((await (await call('GET', `/payment-link/${link.id}`)).json()).status, 'pending');
  await call('POST', `/__dev/pay/${link.id}`);
  const paidLink = await (await call('GET', `/payment-link/${link.id}`)).json();
  assert.equal(paidLink.status, 'paid');
  assert.equal(paidLink.transactions[0].amountBreakdown.base, 10);

  const qr = await (await call('POST', '/codi/qr', { amount: 20, expiration: 600 })).json();
  assert.ok(qr.qrString.length > 20);
  assert.deepEqual((await (await call('GET', `/transaction/codi/qr/${qr.id}`)).json()).items, []);
  await call('POST', `/__dev/pay/${qr.id}`);
  const items = (await (await call('GET', `/transaction/codi/qr/${qr.id}`)).json()).items;
  assert.equal(items[0].status, 'PAID');

  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /pey SIMULADO/);
});
