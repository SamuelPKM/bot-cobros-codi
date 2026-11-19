import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { freshStore, silentLog } from './helpers.js';

const VARS = ['PEY_API_KEY', 'PEY_WEBHOOK_SECRET', 'PUBLIC_BASE_URL', 'RENDER_EXTERNAL_URL', 'DEMO_ENABLED', 'DATABASE_URL', 'TRUSTED_EMAILS', 'DEMO_ACCOUNT_EMAIL', 'DEMO_ACCOUNT_PASSWORD', 'DEMO_MAX_AMOUNT', 'REGISTRATION_OPEN'];

describe('loadConfig', () => {
  let saved;
  beforeEach(() => {
    saved = Object.fromEntries(VARS.map((name) => [name, process.env[name]]));
    for (const name of VARS) delete process.env[name];
    process.env.PEY_API_KEY = 'llave-de-prueba';
  });
  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('en Render toma la URL pública de RENDER_EXTERNAL_URL', () => {
    process.env.RENDER_EXTERNAL_URL = 'https://cobrale.onrender.com/';
    assert.equal(loadConfig().publicBaseUrl, 'https://cobrale.onrender.com');
  });

  it('PUBLIC_BASE_URL tiene prioridad sobre la de Render', () => {
    process.env.RENDER_EXTERNAL_URL = 'https://cobrale.onrender.com';
    process.env.PUBLIC_BASE_URL = 'https://cobrale.mx';
    assert.equal(loadConfig().publicBaseUrl, 'https://cobrale.mx');
  });

  it('arranca sin el secreto del webhook', () => {
    const config = loadConfig();
    assert.equal(config.peyWebhookSecret, null);
    assert.equal(config.publicBaseUrl, null);
  });

  it('lee la base, las cuentas de confianza, la cuenta del jurado y los límites', () => {
    process.env.DATABASE_URL = 'postgres://u:p@neon.example/db?sslmode=require';
    process.env.TRUSTED_EMAILS = 'yo@cobrale.mx, socia@cobrale.mx';
    process.env.DEMO_ACCOUNT_EMAIL = 'jurado@cobrale.mx';
    process.env.DEMO_ACCOUNT_PASSWORD = 'clave-larga';
    process.env.DEMO_MAX_AMOUNT = '2.5';
    process.env.REGISTRATION_OPEN = 'false';
    const config = loadConfig();
    assert.equal(config.databaseUrl, 'postgres://u:p@neon.example/db?sslmode=require');
    assert.deepEqual(config.web.trustedEmails, ['yo@cobrale.mx', 'socia@cobrale.mx']);
    assert.deepEqual(config.web.demoAccount, { email: 'jurado@cobrale.mx', password: 'clave-larga' });
    assert.equal(config.limits.maxAmountCents, 250);
    assert.equal(config.web.registrationOpen, false);
    assert.equal(config.demo, null);
  });
});

describe('servidor sin secreto del webhook', () => {
  it('responde la salud y contesta 503 al webhook de pey hasta que se configure', async () => {
    const app = createApp({ pey: {}, store: await freshStore(), log: silentLog });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      assert.equal((await fetch(`${base}/health`)).status, 200);
      const res = await fetch(`${base}/webhooks/pey`, { method: 'POST', body: '{}' });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'webhook de pey sin configurar' });
    } finally {
      server.close();
    }
  });
});
