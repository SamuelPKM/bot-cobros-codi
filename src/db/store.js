// Todas las consultas de Cóbrale. El resto del código no escribe SQL: usa este
// objeto, así cambiar de base o de esquema toca un solo archivo.
//
// Estados de un cobro:
//   push: awaiting_confirmation -> sending -> pending -> paid
//                                                     -> expired -> link_creating -> link -> paid
//         awaiting_confirmation -> cancelled
//         sending -> failed | unknown (no se supo si pey lo envió)
//   link: creating -> link -> paid        (creating -> failed)
//   qr:   creating -> qr -> paid | expired (creating -> failed)

const CHARGE_COLUMNS = {
  kind: 'kind',
  channel: 'channel',
  merchantId: 'merchant_id',
  ownerKey: 'owner_key',
  notifyTo: 'notify_to',
  payerPhone: 'payer_phone',
  amountCents: 'amount_cents',
  concept: 'concept',
  status: 'status',
  bankAccountId: 'bank_account_id',
  transactionId: 'transaction_id',
  codiId: 'codi_id',
  qrId: 'qr_id',
  qrString: 'qr_string',
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

const MERCHANT_COLUMNS = {
  email: 'email',
  passwordHash: 'password_hash',
  businessName: 'business_name',
  whatsappPhone: 'whatsapp_phone',
  isDemo: 'is_demo',
  isTrusted: 'is_trusted',
  linkCode: 'link_code',
  linkCodeExpiresAt: 'link_code_expires_at',
  bankAccountId: 'bank_account_id',
  bankStatus: 'bank_status',
  bankError: 'bank_error',
  bankClabeLast4: 'bank_clabe_last4',
  bankHolder: 'bank_holder',
  bankCheckedAt: 'bank_checked_at',
  createdAt: 'created_at',
};

function mapper(columns) {
  return (row) => {
    if (!row) return null;
    const out = { id: row.id };
    for (const [key, column] of Object.entries(columns)) out[key] = row[column] ?? null;
    return out;
  };
}

const toCharge = mapper(CHARGE_COLUMNS);
const toMerchant = mapper(MERCHANT_COLUMNS);

/** Arma "a = $2, b = $3" a partir de { a, b }, validando los nombres. */
function assignments(columns, fields, offset = 1) {
  const entries = Object.entries(fields);
  for (const [key] of entries) {
    if (!columns[key]) throw new Error(`campo desconocido "${key}"`);
  }
  return {
    sql: entries.map(([key], i) => `${columns[key]} = $${i + offset}`).join(', '),
    values: entries.map(([, value]) => value ?? null),
  };
}

export function createStore(db, { now = Date.now } = {}) {
  const store = {
    db,

    // ------------------------------------------------------------ cobros

    async createCharge({
      kind = 'push',
      channel,
      merchantId = null,
      ownerKey,
      notifyTo = null,
      payerPhone = null,
      amountCents,
      concept = null,
      status,
      bankAccountId = null,
    }) {
      const row = await db.one(
        `INSERT INTO charges (kind, channel, merchant_id, owner_key, notify_to, payer_phone, amount_cents, concept, status, bank_account_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [kind, channel, merchantId, ownerKey, notifyTo, payerPhone, amountCents, concept, status, bankAccountId, now()],
      );
      return toCharge(row);
    },

    async getCharge(id) {
      return toCharge(await db.one('SELECT * FROM charges WHERE id = $1', [id]));
    },

    async getChargeByTransactionId(transactionId) {
      return toCharge(await db.one('SELECT * FROM charges WHERE transaction_id = $1', [transactionId]));
    },

    async getChargeByQrId(qrId) {
      return toCharge(await db.one('SELECT * FROM charges WHERE qr_id = $1', [qrId]));
    },

    async getChargeByLinkId(linkId) {
      return toCharge(await db.one('SELECT * FROM charges WHERE link_id = $1', [linkId]));
    },

    async updateCharge(id, fields) {
      const { sql, values } = assignments(CHARGE_COLUMNS, fields, 2);
      return toCharge(await db.one(`UPDATE charges SET ${sql} WHERE id = $1 RETURNING *`, [id, ...values]));
    },

    /**
     * Cambia el estado solo si el cobro sigue en `from`. Devuelve true si lo
     * cambió. Es atómico: dos "sí" al mismo tiempo nunca mandan dos cobros.
     */
    async transition(id, from, to) {
      const row = await db.one('UPDATE charges SET status = $1 WHERE id = $2 AND status = $3 RETURNING id', [to, id, from]);
      return Boolean(row);
    },

    /** Marca pagado. Devuelve true solo la primera vez. */
    async markPaid(id, { paidAt, trackingKey = null, paidVia, transactionId = null }) {
      const row = await db.one(
        `UPDATE charges
            SET status = 'paid', paid_at = $2, tracking_key = $3, paid_via = $4,
                transaction_id = COALESCE(transaction_id, $5)
          WHERE id = $1 AND status <> 'paid'
          RETURNING id`,
        [id, paidAt ?? Math.floor(now() / 1000), trackingKey, paidVia, transactionId],
      );
      return Boolean(row);
    },

    async latestCharge(ownerKey, statuses) {
      return toCharge(
        await db.one(
          `SELECT * FROM charges WHERE owner_key = $1 AND status = ANY($2)
           ORDER BY created_at DESC, id DESC LIMIT 1`,
          [ownerKey, statuses],
        ),
      );
    },

    async cancelAwaiting(ownerKey) {
      await db.query(`UPDATE charges SET status = 'cancelled' WHERE owner_key = $1 AND status = 'awaiting_confirmation'`, [
        ownerKey,
      ]);
    },

    /** Cobros enviados cuyo plazo ya venció. */
    async listDue(beforeMs, limit = 100) {
      return (
        await db.query(
          `SELECT * FROM charges WHERE status IN ('pending', 'unknown', 'qr') AND expires_at <= $1 ORDER BY id LIMIT $2`,
          [beforeMs, limit],
        )
      ).map(toCharge);
    },

    /**
     * Cuándo hay que volver a barrer: el vencimiento más próximo, si hay avisos
     * pendientes y la próxima revisión de una CLABE. Sirve para no consultar la
     * base sin motivo y dejar que Neon la duerma.
     */
    async sweepHints() {
      const row = await db.one(
        `SELECT
           (SELECT MIN(expires_at) FROM charges WHERE status IN ('pending', 'unknown', 'qr')) AS next_due_at,
           EXISTS (SELECT 1 FROM charges WHERE status = 'paid' AND notified_at IS NULL AND notify_to IS NOT NULL) AS has_unnotified,
           (SELECT MIN(COALESCE(bank_checked_at, 0)) FROM merchants
             WHERE bank_account_id IS NOT NULL AND bank_status IN ('PENDING', 'PROCESSING')) AS oldest_bank_check_at`,
      );
      return {
        nextDueAt: row.next_due_at,
        hasUnnotified: row.has_unnotified,
        oldestBankCheckAt: row.oldest_bank_check_at,
      };
    },

    /** Cobros pagados cuyo aviso no se pudo entregar. */
    async listPaidNotNotified(limit = 100) {
      return (
        await db.query(
          `SELECT * FROM charges WHERE status = 'paid' AND notified_at IS NULL AND notify_to IS NOT NULL ORDER BY id LIMIT $1`,
          [limit],
        )
      ).map(toCharge);
    },

    async listSince(ownerKey, sinceMs) {
      return (
        await db.query('SELECT * FROM charges WHERE owner_key = $1 AND created_at >= $2 ORDER BY id', [ownerKey, sinceMs])
      ).map(toCharge);
    },

    /** Los cobros más recientes de un dueño, para el panel. `beforeId` pagina hacia atrás. */
    async listCharges(ownerKey, { limit = 50, beforeId = null } = {}) {
      return (
        await db.query(
          `SELECT * FROM charges
            WHERE owner_key = $1 AND status NOT IN ('awaiting_confirmation', 'cancelled')
              AND ($2::int IS NULL OR id < $2)
            ORDER BY id DESC LIMIT $3`,
          [ownerKey, beforeId, limit],
        )
      ).map(toCharge);
    },

    /** Cobros que cambiaron desde `sinceMs`, para actualizar el panel en vivo. */
    async listChangedCharges(ownerKey, ids) {
      if (ids.length === 0) return [];
      return (await db.query('SELECT * FROM charges WHERE owner_key = $1 AND id = ANY($2)', [ownerKey, ids])).map(toCharge);
    },

    async countSentByOwner(ownerKey, sinceMs) {
      const row = await db.one(
        `SELECT COUNT(*) AS n FROM charges
          WHERE owner_key = $1 AND created_at >= $2 AND status NOT IN ('awaiting_confirmation', 'cancelled')`,
        [ownerKey, sinceMs],
      );
      return row.n;
    },

    async countPushesToPayer(payerPhone, sinceMs) {
      const row = await db.one(
        `SELECT COUNT(*) AS n FROM charges
          WHERE payer_phone = $1 AND kind = 'push' AND created_at >= $2
            AND status NOT IN ('awaiting_confirmation', 'cancelled', 'failed')`,
        [payerPhone, sinceMs],
      );
      return row.n;
    },

    // ------------------------------------------------------- comerciantes

    async createMerchant({ email = null, passwordHash = null, businessName, whatsappPhone = null, isDemo = false, isTrusted = false }) {
      const row = await db.one(
        `INSERT INTO merchants (email, password_hash, business_name, whatsapp_phone, is_demo, is_trusted, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [email?.toLowerCase() ?? null, passwordHash, businessName, whatsappPhone, isDemo, isTrusted, now()],
      );
      return toMerchant(row);
    },

    async getMerchant(id) {
      return toMerchant(await db.one('SELECT * FROM merchants WHERE id = $1', [id]));
    },

    async getMerchantByEmail(email) {
      return toMerchant(await db.one('SELECT * FROM merchants WHERE email = $1', [String(email).toLowerCase()]));
    },

    async getMerchantByWhatsapp(phone) {
      return toMerchant(await db.one('SELECT * FROM merchants WHERE whatsapp_phone = $1', [phone]));
    },

    async getMerchantByBankAccountId(bankAccountId) {
      return toMerchant(await db.one('SELECT * FROM merchants WHERE bank_account_id = $1', [bankAccountId]));
    },

    async updateMerchant(id, fields) {
      const { sql, values } = assignments(MERCHANT_COLUMNS, fields, 2);
      return toMerchant(await db.one(`UPDATE merchants SET ${sql} WHERE id = $1 RETURNING *`, [id, ...values]));
    },

    /**
     * Liga un número de WhatsApp al comerciante dueño del código, si el código
     * sigue vigente. El número se quita de cualquier otro comerciante.
     */
    async linkWhatsapp(code, phone) {
      return db.transaction(async (tx) => {
        const merchant = await tx.one('SELECT * FROM merchants WHERE link_code = $1 AND link_code_expires_at > $2 FOR UPDATE', [
          code,
          now(),
        ]);
        if (!merchant) return null;
        await tx.query('UPDATE merchants SET whatsapp_phone = NULL WHERE whatsapp_phone = $1 AND id <> $2', [phone, merchant.id]);
        return toMerchant(
          await tx.one(
            'UPDATE merchants SET whatsapp_phone = $2, link_code = NULL, link_code_expires_at = NULL WHERE id = $1 RETURNING *',
            [merchant.id, phone],
          ),
        );
      });
    },

    /** Cuentas bancarias en validación que no se han revisado desde `beforeMs`. */
    async listBankAccountsToCheck(beforeMs, limit = 20) {
      return (
        await db.query(
          `SELECT * FROM merchants
            WHERE bank_account_id IS NOT NULL AND bank_status IN ('PENDING', 'PROCESSING')
              AND (bank_checked_at IS NULL OR bank_checked_at <= $1)
            ORDER BY bank_checked_at NULLS FIRST LIMIT $2`,
          [beforeMs, limit],
        )
      ).map(toMerchant);
    },

    // ------------------------------------------------------------ sesiones

    async createSession({ tokenHash, merchantId, csrfToken, expiresAt }) {
      await db.query('INSERT INTO sessions (token_hash, merchant_id, csrf_token, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)', [
        tokenHash,
        merchantId,
        csrfToken,
        now(),
        expiresAt,
      ]);
    },

    /** La sesión vigente con su comerciante, o null. */
    async getSession(tokenHash) {
      const row = await db.one('SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2', [tokenHash, now()]);
      if (!row) return null;
      const merchant = await store.getMerchant(row.merchant_id);
      return merchant ? { csrfToken: row.csrf_token, expiresAt: row.expires_at, merchant } : null;
    },

    async deleteSession(tokenHash) {
      await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    },

    // ------------------------------------------------------------- eventos

    /** Registra una entrega de webhook. Devuelve cómo quedó guardada. */
    async recordEvent(source, id, type) {
      await db.query('INSERT INTO events (source, id, type, received_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [
        source,
        id,
        type ?? null,
        now(),
      ]);
      const row = await db.one('SELECT * FROM events WHERE source = $1 AND id = $2', [source, id]);
      return { type: row.type, processedAt: row.processed_at, result: row.result };
    },

    async markEventProcessed(source, id, result) {
      await db.query('UPDATE events SET processed_at = $3, result = $4 WHERE source = $1 AND id = $2', [source, id, now(), result]);
    },

    /** Reclama un mensaje entrante. Devuelve true solo la primera vez. */
    async claimMessage(source, id) {
      const row = await db.one(
        `INSERT INTO events (source, id, type, received_at, processed_at) VALUES ($1, $2, 'message', $3, $3)
         ON CONFLICT DO NOTHING RETURNING id`,
        [source, id, now()],
      );
      return Boolean(row);
    },

    // --------------------------------------------------- límites de uso

    /**
     * Cuenta un uso de `key` en la ventana actual de `windowMs` y dice si cabe
     * en `limit`. Vive en la base para que varias instancias compartan la cuenta.
     */
    async hit(key, { limit, windowMs }) {
      const windowStart = Math.floor(now() / windowMs) * windowMs;
      const row = await db.one(
        `INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, $2, 1)
         ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
         RETURNING hits`,
        [key, windowStart],
      );
      return row.hits <= limit;
    },

    /** Borra datos que ya no sirven: ventanas de límites viejas y sesiones vencidas. */
    async cleanup() {
      const dayAgo = now() - 24 * 60 * 60 * 1000;
      await db.query('DELETE FROM rate_limits WHERE window_start < $1', [dayAgo]);
      await db.query('DELETE FROM sessions WHERE expires_at < $1', [now()]);
    },

    // ------------------------------------------------- demo web pública

    async createDemoSession(id, ip) {
      await db.query('INSERT INTO demo_sessions (id, ip, created_at) VALUES ($1, $2, $3)', [id, ip ?? null, now()]);
    },

    async demoSessionExists(id) {
      return Boolean(await db.one('SELECT 1 AS ok FROM demo_sessions WHERE id = $1', [id]));
    },

    async countDemoSessionsByIp(ip, sinceMs) {
      return (await db.one('SELECT COUNT(*) AS n FROM demo_sessions WHERE ip = $1 AND created_at >= $2', [ip ?? null, sinceMs])).n;
    },

    async addDemoMessage(sessionId, sender, { body = null, imagePng = null } = {}) {
      const row = await db.one(
        'INSERT INTO demo_messages (session_id, sender, body, image_png, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [sessionId, sender, body, imagePng, now()],
      );
      return row.id;
    },

    async listDemoMessages(sessionId, afterId = 0, limit = 100) {
      return (
        await db.query(
          'SELECT id, sender, body, image_png, created_at FROM demo_messages WHERE session_id = $1 AND id > $2 ORDER BY id LIMIT $3',
          [sessionId, afterId, limit],
        )
      ).map((row) => ({ id: row.id, sender: row.sender, body: row.body, imagePng: row.image_png, createdAt: row.created_at }));
    },
  };

  return store;
}
