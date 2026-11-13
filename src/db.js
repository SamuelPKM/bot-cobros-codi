// Base de datos de cobros (SQLite integrado en Node, sin dependencias).
//
// Cada cobro tiene un ID interno (`id`) que se manda a pey en `metadata.chargeId`.
// Así un pago se puede ligar a su cobro aunque nunca hayamos recibido el
// transactionId (por ejemplo, si la respuesta de pey se perdió por un timeout).
//
// Estados de un cobro:
//   awaiting_confirmation -> sending -> pending -> paid
//                                               -> expired -> link_creating -> link -> paid
//   awaiting_confirmation -> cancelled
//   sending -> failed | unknown (no se supo si pey lo envió)

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS charges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_phone  TEXT,
  merchant_wa_id  TEXT,
  payer_phone     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  concept         TEXT,
  status          TEXT NOT NULL,
  transaction_id  TEXT UNIQUE,
  codi_id         TEXT,
  link_id         TEXT UNIQUE,
  link_url        TEXT,
  paid_via        TEXT,
  tracking_key    TEXT,
  error           TEXT,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER,
  paid_at         INTEGER,
  notified_at     INTEGER
);
CREATE INDEX IF NOT EXISTS charges_by_merchant ON charges (merchant_phone, created_at);
CREATE INDEX IF NOT EXISTS charges_by_status ON charges (status, expires_at);

CREATE TABLE IF NOT EXISTS events (
  source        TEXT NOT NULL,
  id            TEXT NOT NULL,
  type          TEXT,
  received_at   INTEGER NOT NULL,
  processed_at  INTEGER,
  result        TEXT,
  PRIMARY KEY (source, id)
);
`;

const COLUMNS = {
  merchantPhone: 'merchant_phone',
  merchantWaId: 'merchant_wa_id',
  payerPhone: 'payer_phone',
  amountCents: 'amount_cents',
  concept: 'concept',
  status: 'status',
  transactionId: 'transaction_id',
  codiId: 'codi_id',
  linkId: 'link_id',
  linkUrl: 'link_url',
  paidVia: 'paid_via',
  trackingKey: 'tracking_key',
  error: 'error',
  createdAt: 'created_at',
  expiresAt: 'expires_at',
  paidAt: 'paid_at',
  notifiedAt: 'notified_at',
};

function toCharge(row) {
  if (!row) return null;
  const charge = { id: row.id };
  for (const [key, column] of Object.entries(COLUMNS)) charge[key] = row[column];
  return charge;
}

export function openDb(file = ':memory:', { now = Date.now } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const sql = new DatabaseSync(file);
  sql.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  sql.exec(SCHEMA);

  const db = {
    createCharge({ merchantPhone = null, merchantWaId = null, payerPhone, amountCents, concept = null, status }) {
      const result = sql
        .prepare(
          `INSERT INTO charges (merchant_phone, merchant_wa_id, payer_phone, amount_cents, concept, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(merchantPhone, merchantWaId, payerPhone, amountCents, concept, status, now());
      return db.getCharge(Number(result.lastInsertRowid));
    },

    getCharge(id) {
      return toCharge(sql.prepare('SELECT * FROM charges WHERE id = ?').get(id));
    },

    getChargeByTransactionId(transactionId) {
      return toCharge(sql.prepare('SELECT * FROM charges WHERE transaction_id = ?').get(transactionId));
    },

    getChargeByLinkId(linkId) {
      return toCharge(sql.prepare('SELECT * FROM charges WHERE link_id = ?').get(linkId));
    },

    updateCharge(id, fields) {
      const entries = Object.entries(fields);
      for (const [key] of entries) {
        if (!COLUMNS[key]) throw new Error(`updateCharge: campo desconocido "${key}"`);
      }
      const assignments = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(', ');
      sql.prepare(`UPDATE charges SET ${assignments} WHERE id = ?`).run(...entries.map(([, v]) => v ?? null), id);
      return db.getCharge(id);
    },

    /**
     * Cambia el estado solo si el cobro sigue en `from`. Devuelve true si lo
     * cambió. Evita, por ejemplo, que dos "sí" seguidos manden dos cobros.
     */
    transition(id, from, to) {
      const result = sql.prepare('UPDATE charges SET status = ? WHERE id = ? AND status = ?').run(to, id, from);
      return result.changes === 1;
    },

    /** Marca pagado. Devuelve true solo la primera vez. */
    markPaid(id, { paidAt, trackingKey = null, paidVia, transactionId = null }) {
      const result = sql
        .prepare(
          `UPDATE charges
              SET status = 'paid', paid_at = ?, tracking_key = ?, paid_via = ?,
                  transaction_id = COALESCE(transaction_id, ?)
            WHERE id = ? AND status != 'paid'`,
        )
        .run(paidAt ?? Math.floor(now() / 1000), trackingKey, paidVia, transactionId, id);
      return result.changes === 1;
    },

    /** El cobro más reciente del comerciante que esté en alguno de los estados dados. */
    latestCharge(merchantPhone, statuses) {
      const marks = statuses.map(() => '?').join(', ');
      return toCharge(
        sql
          .prepare(
            `SELECT * FROM charges WHERE merchant_phone = ? AND status IN (${marks})
             ORDER BY created_at DESC, id DESC LIMIT 1`,
          )
          .get(merchantPhone, ...statuses),
      );
    },

    cancelAwaiting(merchantPhone) {
      sql
        .prepare(`UPDATE charges SET status = 'cancelled' WHERE merchant_phone = ? AND status = 'awaiting_confirmation'`)
        .run(merchantPhone);
    },

    /** Cobros enviados cuyo plazo ya venció. */
    listDue(beforeMs) {
      return sql
        .prepare(`SELECT * FROM charges WHERE status IN ('pending', 'unknown') AND expires_at <= ? ORDER BY id`)
        .all(beforeMs)
        .map(toCharge);
    },

    /** Cobros pagados cuyo aviso al comerciante no se pudo entregar. */
    listPaidNotNotified() {
      return sql
        .prepare(`SELECT * FROM charges WHERE status = 'paid' AND notified_at IS NULL ORDER BY id`)
        .all()
        .map(toCharge);
    },

    listSince(merchantPhone, sinceMs) {
      return sql
        .prepare('SELECT * FROM charges WHERE merchant_phone = ? AND created_at >= ? ORDER BY id')
        .all(merchantPhone, sinceMs)
        .map(toCharge);
    },

    /** Registra una entrega de webhook. Devuelve cómo quedó guardada. */
    recordEvent(source, id, type) {
      sql
        .prepare('INSERT OR IGNORE INTO events (source, id, type, received_at) VALUES (?, ?, ?, ?)')
        .run(source, id, type ?? null, now());
      const row = sql.prepare('SELECT * FROM events WHERE source = ? AND id = ?').get(source, id);
      return { type: row.type, processedAt: row.processed_at, result: row.result };
    },

    markEventProcessed(source, id, result) {
      sql.prepare('UPDATE events SET processed_at = ?, result = ? WHERE source = ? AND id = ?').run(now(), result, source, id);
    },

    /**
     * Reclama un mensaje entrante. Devuelve true solo la primera vez: un
     * mensaje repetido nunca se vuelve a ejecutar (podría duplicar un cobro).
     */
    claimMessage(source, id) {
      const result = sql
        .prepare('INSERT OR IGNORE INTO events (source, id, type, received_at, processed_at) VALUES (?, ?, ?, ?, ?)')
        .run(source, id, 'message', now(), now());
      return result.changes === 1;
    },

    close() {
      sql.close();
    },
  };

  return db;
}
