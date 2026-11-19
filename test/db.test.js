import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { openDb } from '../src/db.js';
import { createOutbox } from '../src/outbox.js';
import { silentLog } from './helpers.js';

describe('base de datos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cobros-db-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('pone al día una base de la versión anterior sin perder cobros', () => {
    const file = join(dir, 'vieja.db');
    // Esquema de la primera versión: teléfono obligatorio, sin kind ni qr_id.
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE charges (
        id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_phone TEXT, merchant_wa_id TEXT,
        payer_phone TEXT NOT NULL, amount_cents INTEGER NOT NULL, concept TEXT, status TEXT NOT NULL,
        transaction_id TEXT UNIQUE, codi_id TEXT, link_id TEXT UNIQUE, link_url TEXT, paid_via TEXT,
        tracking_key TEXT, error TEXT, created_at INTEGER NOT NULL, expires_at INTEGER, paid_at INTEGER,
        notified_at INTEGER
      );
      CREATE INDEX charges_by_merchant ON charges (merchant_phone, created_at);
      CREATE INDEX charges_by_status ON charges (status, expires_at);
      INSERT INTO charges (merchant_phone, payer_phone, amount_cents, concept, status, transaction_id, created_at)
      VALUES ('5511112222', '5512345678', 15000, 'corte', 'paid', 'TX-VIEJO', 1);
    `);
    old.close();

    const db = openDb(file);
    const migrated = db.getChargeByTransactionId('TX-VIEJO');
    assert.equal(migrated.kind, 'push');
    assert.equal(migrated.amountCents, 15000);
    assert.equal(migrated.status, 'paid');

    // Ahora acepta cobros sin teléfono, y la migración no se repite al reabrir.
    const qr = db.createCharge({ kind: 'qr', merchantPhone: '5511112222', amountCents: 100, status: 'creating' });
    db.updateCharge(qr.id, { qrId: 'IDC1' });
    db.close();

    const reopened = openDb(file);
    assert.equal(reopened.getChargeByQrId('IDC1').kind, 'qr');
    assert.equal(reopened.getChargeByTransactionId('TX-VIEJO').concept, 'corte');
    reopened.close();
  });

  it('countPushesToPayer no cuenta borradores, cancelados ni fallidos', () => {
    const db = openDb(':memory:');
    for (const status of ['awaiting_confirmation', 'cancelled', 'failed', 'pending', 'paid']) {
      db.createCharge({ merchantPhone: 'm', payerPhone: '5512345678', amountCents: 1, status });
    }
    db.createCharge({ kind: 'qr', merchantPhone: 'm', amountCents: 1, status: 'qr' });

    assert.equal(db.countPushesToPayer('5512345678', 0), 2);
    assert.equal(db.countSentByMerchant('m', 0), 4);
  });
});

describe('outbox', () => {
  it('manda a la conversación de la demo lo que es para "demo:<sesión>"', async () => {
    const db = openDb(':memory:');
    const sent = [];
    const outbox = createOutbox({ db, whatsapp: { sendText: async (to, body) => sent.push({ to, body }) }, log: silentLog });

    await outbox.sendText('demo:abc', 'hola demo');
    await outbox.sendImage('demo:abc', { png: Buffer.from('img'), caption: 'QR' });
    await outbox.sendText('5215511112222', 'hola WhatsApp');

    assert.deepEqual(
      db.listDemoMessages('abc').map((m) => [m.sender, m.body, m.imagePng]),
      [
        ['bot', 'hola demo', null],
        ['bot', 'QR', Buffer.from('img').toString('base64')],
      ],
    );
    assert.deepEqual(sent, [{ to: '5215511112222', body: 'hola WhatsApp' }]);
  });

  it('sin WhatsApp configurado, solo lo registra en la terminal', async () => {
    const lines = [];
    const outbox = createOutbox({ db: openDb(':memory:'), log: { info: (line) => lines.push(line) } });
    await outbox.sendText('5215511112222', 'hola');
    assert.match(lines[0], /\[sin WhatsApp\] para 5215511112222/);
  });
});
