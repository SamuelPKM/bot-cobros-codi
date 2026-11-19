import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { connect } from '../src/db/connection.js';
import { migrate } from '../src/db/schema.js';
import { createStore } from '../src/db/store.js';
import { createOutbox } from '../src/outbox.js';
import { fakeClock, freshStore, silentLog } from './helpers.js';

describe('esquema', () => {
  it('las migraciones se aplican una sola vez aunque se corran varias veces', async () => {
    const db = await connect();
    await migrate(db);
    await migrate(db);
    const rows = await db.query('SELECT id FROM schema_migrations');
    assert.deepEqual(rows.map((r) => r.id), [1]);
    await db.close();
  });

  it('PGlite guarda en disco y conserva los datos al reabrir', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'cobrale-pglite-'));
    try {
      let db = await connect({ dataDir: dir });
      await migrate(db);
      await createStore(db).createMerchant({ email: 'a@b.mx', businessName: 'Leo' });
      await db.close();

      db = await connect({ dataDir: dir });
      await migrate(db);
      assert.equal((await createStore(db).getMerchantByEmail('A@B.mx')).businessName, 'Leo');
      await db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('store', () => {
  it('transition es atómica: solo uno de dos cambios simultáneos gana', async () => {
    const store = await freshStore();
    const charge = await store.createCharge({ channel: 'web', ownerKey: 'm:1', amountCents: 100, status: 'awaiting_confirmation' });
    const results = await Promise.all([
      store.transition(charge.id, 'awaiting_confirmation', 'sending'),
      store.transition(charge.id, 'awaiting_confirmation', 'sending'),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
  });

  it('rechaza montos de cero o negativos', async () => {
    const store = await freshStore();
    await assert.rejects(store.createCharge({ channel: 'web', ownerKey: 'm:1', amountCents: 0, status: 'creating' }));
  });

  it('countPushesToPayer no cuenta borradores, cancelados ni fallidos', async () => {
    const store = await freshStore();
    for (const status of ['awaiting_confirmation', 'cancelled', 'failed', 'pending', 'paid']) {
      await store.createCharge({ channel: 'web', ownerKey: 'm:1', payerPhone: '5512345678', amountCents: 1, status });
    }
    await store.createCharge({ kind: 'qr', channel: 'web', ownerKey: 'm:1', amountCents: 1, status: 'qr' });

    assert.equal(await store.countPushesToPayer('5512345678', 0), 2);
    assert.equal(await store.countSentByOwner('m:1', 0), 4);
  });

  it('listCharges solo trae los del dueño, sin borradores ni cancelados, del más nuevo al más viejo', async () => {
    const store = await freshStore();
    for (const [owner, status] of [['m:1', 'paid'], ['m:2', 'paid'], ['m:1', 'cancelled'], ['m:1', 'qr'], ['m:1', 'awaiting_confirmation']]) {
      await store.createCharge({ channel: 'web', ownerKey: owner, amountCents: 1, status });
    }
    const list = await store.listCharges('m:1');
    assert.deepEqual(list.map((c) => c.status), ['qr', 'paid']);
  });

  it('hit cuenta por ventana y se reinicia en la siguiente', async () => {
    const now = fakeClock();
    const store = await freshStore({ now });
    const hit = () => store.hit('k', { limit: 2, windowMs: 60_000 });
    assert.deepEqual([await hit(), await hit(), await hit()], [true, true, false]);
    now.advance(60_000);
    assert.equal(await hit(), true);
  });

  it('linkWhatsapp mueve el número de otra cuenta a la dueña del código', async () => {
    const now = fakeClock();
    const store = await freshStore({ now });
    const a = await store.createMerchant({ businessName: 'A', whatsappPhone: '5511112222' });
    const b = await store.createMerchant({ businessName: 'B' });
    await store.updateMerchant(b.id, { linkCode: '111111', linkCodeExpiresAt: now() + 1000 });

    const linked = await store.linkWhatsapp('111111', '5511112222');

    assert.equal(linked.id, b.id);
    assert.equal((await store.getMerchant(a.id)).whatsappPhone, null);
    assert.equal((await store.getMerchantByWhatsapp('5511112222')).id, b.id);
  });

  it('las sesiones vencidas no sirven y cleanup las borra', async () => {
    const now = fakeClock();
    const store = await freshStore({ now });
    const m = await store.createMerchant({ email: 'a@b.mx', businessName: 'A' });
    await store.createSession({ tokenHash: 'h', merchantId: m.id, csrfToken: 'c', expiresAt: now() + 1000 });
    assert.equal((await store.getSession('h')).merchant.id, m.id);

    now.advance(2000);
    assert.equal(await store.getSession('h'), null);
    await store.cleanup();
    assert.equal((await store.db.query('SELECT * FROM sessions')).length, 0);
  });
});

describe('outbox', () => {
  it('manda a la conversación de la demo lo que es para "demo:<sesión>"', async () => {
    const store = await freshStore();
    await store.createDemoSession('abc', '1.2.3.4');
    const sent = [];
    const outbox = createOutbox({ store, whatsapp: { sendText: async (to, body) => sent.push({ to, body }) }, log: silentLog });

    await outbox.sendText('demo:abc', 'hola demo');
    await outbox.sendImage('demo:abc', { png: Buffer.from('img'), caption: 'QR' });
    await outbox.sendText('5215511112222', 'hola WhatsApp');

    assert.deepEqual(
      (await store.listDemoMessages('abc')).map((m) => [m.sender, m.body, m.imagePng]),
      [
        ['bot', 'hola demo', null],
        ['bot', 'QR', Buffer.from('img').toString('base64')],
      ],
    );
    assert.deepEqual(sent, [{ to: '5215511112222', body: 'hola WhatsApp' }]);
  });

  it('sin WhatsApp configurado, solo lo registra en la terminal', async () => {
    const lines = [];
    const outbox = createOutbox({ store: await freshStore(), log: { info: (line) => lines.push(line) } });
    await outbox.sendText('5215511112222', 'hola');
    assert.match(lines[0], /\[sin WhatsApp\] para 5215511112222/);
  });
});
