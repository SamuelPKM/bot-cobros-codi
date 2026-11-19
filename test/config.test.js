import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { silentLog } from './helpers.js';

const VARS = ['PEY_API_KEY', 'PEY_WEBHOOK_SECRET', 'PUBLIC_BASE_URL', 'RENDER_EXTERNAL_URL', 'DEMO_ENABLED'];

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
    assert.equal(config.peyWebhookSecret, undefined);
    assert.equal(config.publicBaseUrl, null);
  });
});

describe('servidor sin secreto del webhook', () => {
  it('responde la salud y contesta 503 al webhook de pey hasta que se configure', async () => {
    const app = createApp({ pey: {}, db: openDb(':memory:'), log: silentLog });
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
