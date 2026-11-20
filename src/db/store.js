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
  createdBy: 'created_by',
};

// Un negocio. Sus personas (administradores y vendedores) están en `users`.
const MERCHANT_COLUMNS = {
  businessName: 'business_name',
  isDemo: 'is_demo',
  isTrusted: 'is_trusted',
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

// Una persona de un negocio. El administrador también vende.
const USER_COLUMNS = {
  merchantId: 'merchant_id',
  role: 'role',
  name: 'name',
  email: 'email',
  passwordHash: 'password_hash',
  whatsappPhone: 'whatsapp_phone',
  linkCode: 'link_code',
  linkCodeExpiresAt: 'link_code_expires_at',
  inviteTokenHash: 'invite_token_hash',
  inviteExpiresAt: 'invite_expires_at',
  active: 'active',
  createdAt: 'created_at',
};

const toCharge = mapper(CHARGE_COLUMNS);
const toMerchant = mapper(MERCHANT_COLUMNS);
const toUser = mapper(USER_COLUMNS);

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
      createdBy = null,
    }) {
      const row = await db.one(
        `INSERT INTO charges (kind, channel, merchant_id, owner_key, notify_to, payer_phone, amount_cents, concept, status, bank_account_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [kind, channel, merchantId, ownerKey, notifyTo, payerPhone, amountCents, concept, status, bankAccountId, createdBy, now()],
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

    /**
     * El cobro más reciente en esos estados. `createdBy` lo limita a los de una
     * persona: cada vendedor confirma sus propios borradores, no los de otro.
     */
    async latestCharge(ownerKey, statuses, createdBy = null) {
      return toCharge(
        await db.one(
          `SELECT * FROM charges WHERE owner_key = $1 AND status = ANY($2) AND ($3::int IS NULL OR created_by = $3)
           ORDER BY created_at DESC, id DESC LIMIT 1`,
          [ownerKey, statuses, createdBy],
        ),
      );
    },

    async cancelAwaiting(ownerKey, createdBy = null) {
      await db.query(
        `UPDATE charges SET status = 'cancelled'
          WHERE owner_key = $1 AND status = 'awaiting_confirmation' AND ($2::int IS NULL OR created_by = $2)`,
        [ownerKey, createdBy],
      );
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

    /** Cobros desde `sinceMs`: los del negocio, o solo los de una persona con `createdBy`. */
    async listSince(ownerKey, sinceMs, createdBy = null) {
      return (
        await db.query(
          'SELECT * FROM charges WHERE owner_key = $1 AND created_at >= $2 AND ($3::int IS NULL OR created_by = $3) ORDER BY id',
          [ownerKey, sinceMs, createdBy],
        )
      ).map(toCharge);
    },

    /**
     * Los cobros más recientes, para el panel. `createdBy` limita a los de una
     * persona; `beforeId` pagina hacia atrás.
     */
    async listCharges(ownerKey, { limit = 50, beforeId = null, createdBy = null } = {}) {
      return (
        await db.query(
          `SELECT * FROM charges
            WHERE owner_key = $1 AND status NOT IN ('awaiting_confirmation', 'cancelled')
              AND ($2::int IS NULL OR id < $2) AND ($4::int IS NULL OR created_by = $4)
            ORDER BY id DESC LIMIT $3`,
          [ownerKey, beforeId, limit, createdBy],
        )
      ).map(toCharge);
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

    // ------------------------------------------------------------ negocios

    async createMerchant({ businessName, isDemo = false, isTrusted = false }) {
      const row = await db.one(
        'INSERT INTO merchants (business_name, is_demo, is_trusted, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [businessName, isDemo, isTrusted, now()],
      );
      return toMerchant(row);
    },

    /** Crea un negocio con su primer administrador, en una sola transacción. */
    async createMerchantWithAdmin({ businessName, isDemo = false, isTrusted = false, name, email = null, passwordHash = null, whatsappPhone = null }) {
      return db.transaction(async (tx) => {
        const merchant = toMerchant(
          await tx.one('INSERT INTO merchants (business_name, is_demo, is_trusted, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [
            businessName,
            isDemo,
            isTrusted,
            now(),
          ]),
        );
        const user = toUser(
          await tx.one(
            `INSERT INTO users (merchant_id, role, name, email, password_hash, whatsapp_phone, created_at)
             VALUES ($1, 'admin', $2, $3, $4, $5, $6) RETURNING *`,
            [merchant.id, name, email?.toLowerCase() ?? null, passwordHash, whatsappPhone, now()],
          ),
        );
        return { merchant, user };
      });
    },

    async getMerchant(id) {
      return toMerchant(await db.one('SELECT * FROM merchants WHERE id = $1', [id]));
    },

    async getMerchantByBankAccountId(bankAccountId) {
      return toMerchant(await db.one('SELECT * FROM merchants WHERE bank_account_id = $1', [bankAccountId]));
    },

    async updateMerchant(id, fields) {
      const { sql, values } = assignments(MERCHANT_COLUMNS, fields, 2);
      return toMerchant(await db.one(`UPDATE merchants SET ${sql} WHERE id = $1 RETURNING *`, [id, ...values]));
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

    // ------------------------------------------------------------ personas

    async createUser({ merchantId, role, name, email = null, passwordHash = null, whatsappPhone = null, inviteTokenHash = null, inviteExpiresAt = null }) {
      return toUser(
        await db.one(
          `INSERT INTO users (merchant_id, role, name, email, password_hash, whatsapp_phone, invite_token_hash, invite_expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [merchantId, role, name, email?.toLowerCase() ?? null, passwordHash, whatsappPhone, inviteTokenHash, inviteExpiresAt, now()],
        ),
      );
    },

    async getUser(id) {
      return toUser(await db.one('SELECT * FROM users WHERE id = $1', [id]));
    },

    async getUserByEmail(email) {
      return toUser(await db.one('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]));
    },

    /** La persona activa ligada a ese WhatsApp. */
    async getUserByWhatsapp(phone) {
      return toUser(await db.one('SELECT * FROM users WHERE whatsapp_phone = $1 AND active', [phone]));
    },

    /** La invitación vigente y sin usar con ese token. */
    async getUserByInvite(tokenHash) {
      return toUser(
        await db.one('SELECT * FROM users WHERE invite_token_hash = $1 AND invite_expires_at > $2 AND password_hash IS NULL AND active', [
          tokenHash,
          now(),
        ]),
      );
    },

    /** El equipo del negocio: administradores primero, luego por nombre. */
    async listUsers(merchantId) {
      return (
        await db.query(`SELECT * FROM users WHERE merchant_id = $1 ORDER BY active DESC, role = 'admin' DESC, name, id`, [merchantId])
      ).map(toUser);
    },

    async countActiveAdmins(merchantId) {
      return Number((await db.one(`SELECT COUNT(*) AS n FROM users WHERE merchant_id = $1 AND role = 'admin' AND active`, [merchantId])).n);
    },

    /**
     * Cambia el rol de alguien del equipo o lo desactiva, sin dejar nunca al
     * negocio sin un administrador activo. Bloquea el negocio mientras decide,
     * así dos administradores no pueden quitarse el rol uno al otro a la vez.
     * @returns {{ ok: true, user } | { ok: false, reason: 'not_found' | 'last_admin' }}
     */
    async changeMember(merchantId, userId, { role = null, deactivate = false }) {
      return db.transaction(async (tx) => {
        await tx.one('SELECT id FROM merchants WHERE id = $1 FOR UPDATE', [merchantId]);
        const member = toUser(await tx.one('SELECT * FROM users WHERE id = $1 AND merchant_id = $2', [userId, merchantId]));
        if (!member) return { ok: false, reason: 'not_found' };
        const losesAdmin = member.active && member.role === 'admin' && (deactivate || (role && role !== 'admin'));
        if (losesAdmin) {
          const { n } = await tx.one(`SELECT COUNT(*) AS n FROM users WHERE merchant_id = $1 AND role = 'admin' AND active`, [merchantId]);
          if (Number(n) <= 1) return { ok: false, reason: 'last_admin' };
        }
        if (deactivate) {
          await tx.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
          const user = await tx.one(
            `UPDATE users SET active = FALSE, whatsapp_phone = NULL, link_code = NULL, link_code_expires_at = NULL,
                    invite_token_hash = NULL, invite_expires_at = NULL
              WHERE id = $1 RETURNING *`,
            [userId],
          );
          return { ok: true, user: toUser(user) };
        }
        const user = await tx.one('UPDATE users SET role = $2 WHERE id = $1 RETURNING *', [userId, role ?? member.role]);
        return { ok: true, user: toUser(user) };
      });
    },

    async updateUser(id, fields) {
      const { sql, values } = assignments(USER_COLUMNS, fields, 2);
      return toUser(await db.one(`UPDATE users SET ${sql} WHERE id = $1 RETURNING *`, [id, ...values]));
    },

    /** Desactiva a una persona: no puede entrar, cobrar ni usar su WhatsApp. Sus cobros se conservan. */
    async deactivateUser(id) {
      return db.transaction(async (tx) => {
        await tx.query('DELETE FROM sessions WHERE user_id = $1', [id]);
        return toUser(
          await tx.one(
            `UPDATE users SET active = FALSE, whatsapp_phone = NULL, link_code = NULL, link_code_expires_at = NULL,
                    invite_token_hash = NULL, invite_expires_at = NULL
              WHERE id = $1 RETURNING *`,
            [id],
          ),
        );
      });
    },

    /**
     * Liga un número de WhatsApp a la persona dueña del código, si sigue
     * vigente. El número se quita de cualquier otra persona.
     */
    async linkWhatsapp(code, phone) {
      return db.transaction(async (tx) => {
        const user = await tx.one('SELECT * FROM users WHERE link_code = $1 AND link_code_expires_at > $2 AND active FOR UPDATE', [
          code,
          now(),
        ]);
        if (!user) return null;
        await tx.query('UPDATE users SET whatsapp_phone = NULL WHERE whatsapp_phone = $1 AND id <> $2', [phone, user.id]);
        return toUser(
          await tx.one('UPDATE users SET whatsapp_phone = $2, link_code = NULL, link_code_expires_at = NULL WHERE id = $1 RETURNING *', [
            user.id,
            phone,
          ]),
        );
      });
    },

    // ------------------------------------------------------------ sesiones

    async createSession({ tokenHash, userId, csrfToken, expiresAt }) {
      await db.query('INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)', [
        tokenHash,
        userId,
        csrfToken,
        now(),
        expiresAt,
      ]);
    },

    /** La sesión vigente con su persona (si sigue activa) y su negocio, o null. */
    async getSession(tokenHash) {
      const row = await db.one('SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2', [tokenHash, now()]);
      if (!row) return null;
      const user = await store.getUser(row.user_id);
      if (!user?.active) return null;
      const merchant = await store.getMerchant(user.merchantId);
      return merchant ? { csrfToken: row.csrf_token, expiresAt: row.expires_at, user, merchant } : null;
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
