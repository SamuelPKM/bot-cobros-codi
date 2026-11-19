// Base de datos de cobros (SQLite integrado en Node, sin dependencias).
//
// Cada cobro tiene un ID interno (`id`) que se manda a pey en `metadata.chargeId`.
// Así un pago se puede ligar a su cobro aunque nunca hayamos recibido el
// transactionId (por ejemplo, si la respuesta de pey se perdió por un timeout).
//
// Tres tipos de cobro (`kind`):
//   push: notificación al celular del cliente; necesita su teléfono.
//   link: liga de pago que el comerciante reenvía por donde quiera.
//   qr:   código QR CoDi que el cliente escanea.
//
// Estados de un cobro:
//   push: awaiting_confirmation -> sending -> pending -> paid
//                                                     -> expired -> link_creating -> link -> paid
//         awaiting_confirmation -> cancelled
//         sending -> failed | unknown (no se supo si pey lo envió)
//   link: link -> paid
//   qr:   qr -> paid | expired

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const CHARGES_TABLE = `
CREATE TABLE IF NOT EXISTS charges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT NOT NULL DEFAULT 'push',
  merchant_phone  TEXT,
  merchant_wa_id  TEXT,
  payer_phone     TEXT,
  amount_cents    INTEGER NOT NULL,
  concept         TEXT,
  status          TEXT NOT NULL,
  transaction_id  TEXT UNIQUE,
  codi_id         TEXT,
  qr_id           TEXT UNIQUE,
  link_id         TEXT UNIQUE,
  link_url        TEXT,
  paid_via        TEXT,
  tracking_key    TEXT,
  error           TEXT,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER,
  paid_at         INTEGER,
  notified_at     INTEGER
)`;

const SCHEMA = `
${CHARGES_TABLE};
CREATE INDEX IF NOT EXISTS charges_by_merchant ON charges (merchant_phone, created_at);
CREATE INDEX IF NOT EXISTS charges_by_status ON charges (status, expires_at);
CREATE INDEX IF NOT EXISTS charges_by_payer ON charges (payer_phone, created_at);

CREATE TABLE IF NOT EXISTS events (
  source        TEXT NOT NULL,
  id            TEXT NOT NULL,
  type          TEXT,
  received_at   INTEGER NOT NULL,
  processed_at  INTEGER,
  result        TEXT,
  PRIMARY KEY (source, id)
);

CREATE TABLE IF NOT EXISTS demo_sessions (
  id          TEXT PRIMARY KEY,
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS demo_sessions_by_ip ON demo_sessions (ip, created_at);

CREATE TABLE IF NOT EXISTS demo_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  sender      TEXT NOT NULL,
  body        TEXT,
  image_png   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS demo_messages_by_session ON demo_messages (session_id, id);
`;

/**
 * Pone al día una base creada con una versión anterior: en ella el teléfono
 * era obligatorio y no existían `kind` ni `qr_id`. SQLite no deja quitar un
 * NOT NULL, así que la tabla se reconstruye copiando las filas.
 */
function migrate(sql) {
  const columns = sql.prepare('PRAGMA table_info(charges)').all();
  if (columns.length === 0) return;
  const has = (name) => columns.some((c) => c.name === name);
  const payerRequired = columns.find((c) => c.name === 'payer_phone')?.notnull === 1;
  if (has('kind') && has('qr_id') && !payerRequired) return;

  const shared = columns.map((c) => c.name).join(', ');
  sql.exec('BEGIN');
  try {
    sql.exec('ALTER TABLE charges RENAME TO charges_old');
    sql.exec('DROP INDEX IF EXISTS charges_by_merchant; DROP INDEX IF EXISTS charges_by_status;');
    sql.exec(CHARGES_TABLE);
    sql.exec(`INSERT INTO charges (${shared}) SELECT ${shared} FROM charges_old`);
    sql.exec('DROP TABLE charges_old');
    sql.exec('COMMIT');
  } catch (error) {
    sql.exec('ROLLBACK');
    throw error;
  }
}

const COLUMNS = {
  kind: 'kind',
  merchantPhone: 'merchant_phone',
  merchantWaId: 'merchant_wa_id',
  payerPhone: 'payer_phone',
  amountCents: 'amount_cents',
  concept: 'concept',
  status: 'status',
  transactionId: 'transaction_id',
  codiId: 'codi_id',
  qrId: 'qr_id',
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
  migrate(sql);
  sql.exec(SCHEMA);

  const db = {
    createCharge({
      kind = 'push',
      merchantPhone = null,
      merchantWaId = null,
      payerPhone = null,
      amountCents,
      concept = null,
      status,
    }) {
      const result = sql
        .prepare(
          `INSERT INTO charges (kind, merchant_phone, merchant_wa_id, payer_phone, amount_cents, concept, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(kind, merchantPhone, merchantWaId, payerPhone, amountCents, concept, status, now());
      return db.getCharge(Number(result.lastInsertRowid));
    },

    getChargeByQrId(qrId) {
      return toCharge(sql.prepare('SELECT * FROM charges WHERE qr_id = ?').get(qrId));
    },

    /** Cuántos cobros salieron (o se intentaron) de un comerciante desde `sinceMs`. Para los límites de la demo. */
    countSentByMerchant(merchantPhone, sinceMs) {
      return sql
        .prepare(
          `SELECT COUNT(*) AS n FROM charges
            WHERE merchant_phone = ? AND created_at >= ? AND status NOT IN ('awaiting_confirmation', 'cancelled')`,
        )
        .get(merchantPhone, sinceMs).n;
    },

    /** Cuántos push se mandaron a un teléfono desde `sinceMs`, de cualquier comerciante. */
    countPushesToPayer(payerPhone, sinceMs) {
      return sql
        .prepare(
          `SELECT COUNT(*) AS n FROM charges
            WHERE payer_phone = ? AND kind = 'push' AND created_at >= ?
              AND status NOT IN ('awaiting_confirmation', 'cancelled', 'failed')`,
        )
        .get(payerPhone, sinceMs).n;
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
        .prepare(`SELECT * FROM charges WHERE status IN ('pending', 'unknown', 'qr') AND expires_at <= ? ORDER BY id`)
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

    // --------------------------------------------------- demo web pública

    createDemoSession(id, ip) {
      sql.prepare('INSERT INTO demo_sessions (id, ip, created_at) VALUES (?, ?, ?)').run(id, ip ?? null, now());
    },

    demoSessionExists(id) {
      return Boolean(sql.prepare('SELECT 1 FROM demo_sessions WHERE id = ?').get(id));
    },

    countDemoSessionsByIp(ip, sinceMs) {
      return sql.prepare('SELECT COUNT(*) AS n FROM demo_sessions WHERE ip = ? AND created_at >= ?').get(ip ?? null, sinceMs).n;
    },

    /** Guarda un mensaje de la conversación de demo. `sender` es 'user' o 'bot'. */
    addDemoMessage(sessionId, sender, { body = null, imagePng = null } = {}) {
      const result = sql
        .prepare('INSERT INTO demo_messages (session_id, sender, body, image_png, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(sessionId, sender, body, imagePng, now());
      return Number(result.lastInsertRowid);
    },

    listDemoMessages(sessionId, afterId = 0, limit = 100) {
      return sql
        .prepare(
          'SELECT id, sender, body, image_png, created_at FROM demo_messages WHERE session_id = ? AND id > ? ORDER BY id LIMIT ?',
        )
        .all(sessionId, afterId, limit)
        .map((row) => ({ id: row.id, sender: row.sender, body: row.body, imagePng: row.image_png, createdAt: row.created_at }));
    },

    close() {
      sql.close();
    },
  };

  return db;
}
