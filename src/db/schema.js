// Esquema de Postgres. Cada migración se aplica una sola vez y en orden; la
// tabla schema_migrations recuerda cuáles ya corrieron. Para cambiar el
// esquema se agrega una migración nueva al final, nunca se edita una vieja.

export const MIGRATIONS = [
  {
    id: 1,
    name: 'esquema inicial',
    sql: `
      CREATE TABLE merchants (
        id               SERIAL PRIMARY KEY,
        email            TEXT UNIQUE,
        password_hash    TEXT,
        business_name    TEXT NOT NULL,
        whatsapp_phone   TEXT UNIQUE,
        is_demo          BOOLEAN NOT NULL DEFAULT FALSE,
        is_trusted       BOOLEAN NOT NULL DEFAULT FALSE,
        link_code        TEXT UNIQUE,
        link_code_expires_at BIGINT,
        bank_account_id  TEXT UNIQUE,
        bank_status      TEXT,
        bank_error       TEXT,
        bank_clabe_last4 TEXT,
        bank_holder      TEXT,
        bank_checked_at  BIGINT,
        created_at       BIGINT NOT NULL
      );

      CREATE TABLE sessions (
        token_hash   TEXT PRIMARY KEY,
        merchant_id  INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        csrf_token   TEXT NOT NULL,
        created_at   BIGINT NOT NULL,
        expires_at   BIGINT NOT NULL
      );
      CREATE INDEX sessions_by_merchant ON sessions (merchant_id);

      -- owner_key agrupa los cobros de quien los ve: 'm:<id>' para un comerciante
      -- (web y WhatsApp comparten sus cobros) o 'demo:<sesión>' en la demo pública.
      -- notify_to es a dónde se avisa el pago: un número de WhatsApp, una sesión
      -- de demo, o nada (la web lo muestra sola).
      CREATE TABLE charges (
        id              SERIAL PRIMARY KEY,
        kind            TEXT NOT NULL,
        channel         TEXT NOT NULL,
        merchant_id     INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
        owner_key       TEXT NOT NULL,
        notify_to       TEXT,
        payer_phone     TEXT,
        amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
        concept         TEXT,
        status          TEXT NOT NULL,
        bank_account_id TEXT,
        transaction_id  TEXT UNIQUE,
        codi_id         TEXT,
        qr_id           TEXT UNIQUE,
        qr_string       TEXT,
        link_id         TEXT UNIQUE,
        link_url        TEXT,
        paid_via        TEXT,
        tracking_key    TEXT,
        error           TEXT,
        created_at      BIGINT NOT NULL,
        expires_at      BIGINT,
        paid_at         BIGINT,
        notified_at     BIGINT
      );
      CREATE INDEX charges_by_owner ON charges (owner_key, created_at DESC);
      CREATE INDEX charges_due ON charges (expires_at) WHERE status IN ('pending', 'unknown', 'qr');
      CREATE INDEX charges_to_notify ON charges (id) WHERE status = 'paid' AND notified_at IS NULL;
      CREATE INDEX charges_by_payer ON charges (payer_phone, created_at);

      CREATE TABLE events (
        source        TEXT NOT NULL,
        id            TEXT NOT NULL,
        type          TEXT,
        received_at   BIGINT NOT NULL,
        processed_at  BIGINT,
        result        TEXT,
        PRIMARY KEY (source, id)
      );

      -- Límites de uso compartidos entre instancias: un contador por clave y ventana.
      CREATE TABLE rate_limits (
        key         TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        hits        INTEGER NOT NULL,
        PRIMARY KEY (key, window_start)
      );

      CREATE TABLE demo_sessions (
        id          TEXT PRIMARY KEY,
        ip          TEXT,
        created_at  BIGINT NOT NULL
      );
      CREATE INDEX demo_sessions_by_ip ON demo_sessions (ip, created_at);

      CREATE TABLE demo_messages (
        id          SERIAL PRIMARY KEY,
        session_id  TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
        sender      TEXT NOT NULL,
        body        TEXT,
        image_png   TEXT,
        created_at  BIGINT NOT NULL
      );
      CREATE INDEX demo_messages_by_session ON demo_messages (session_id, id);
    `,
  },
  {
    id: 2,
    name: 'equipos: administradores y vendedores',
    // Un negocio (merchants) tiene varias personas (users). El administrador
    // también vende. El correo, la contraseña y el WhatsApp pasan de la
    // cuenta del negocio a cada persona, y cada cobro recuerda quién lo hizo.
    sql: `
      CREATE TABLE users (
        id                   SERIAL PRIMARY KEY,
        merchant_id          INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        role                 TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
        name                 TEXT NOT NULL,
        email                TEXT UNIQUE,
        password_hash        TEXT,
        whatsapp_phone       TEXT UNIQUE,
        link_code            TEXT UNIQUE,
        link_code_expires_at BIGINT,
        invite_token_hash    TEXT UNIQUE,
        invite_expires_at    BIGINT,
        active               BOOLEAN NOT NULL DEFAULT TRUE,
        created_at           BIGINT NOT NULL
      );
      CREATE INDEX users_by_merchant ON users (merchant_id);

      -- Cada negocio existente queda con su dueño como administrador.
      INSERT INTO users (merchant_id, role, name, email, password_hash, whatsapp_phone, link_code, link_code_expires_at, created_at)
      SELECT id, 'admin', business_name, email, password_hash, whatsapp_phone, link_code, link_code_expires_at, created_at
        FROM merchants;

      ALTER TABLE merchants DROP COLUMN email;
      ALTER TABLE merchants DROP COLUMN password_hash;
      ALTER TABLE merchants DROP COLUMN whatsapp_phone;
      ALTER TABLE merchants DROP COLUMN link_code;
      ALTER TABLE merchants DROP COLUMN link_code_expires_at;

      -- Las sesiones ahora son de una persona. Las abiertas se cierran.
      DROP TABLE sessions;
      CREATE TABLE sessions (
        token_hash   TEXT PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf_token   TEXT NOT NULL,
        created_at   BIGINT NOT NULL,
        expires_at   BIGINT NOT NULL
      );
      CREATE INDEX sessions_by_user ON sessions (user_id);

      ALTER TABLE charges ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      UPDATE charges c SET created_by = u.id FROM users u WHERE u.merchant_id = c.merchant_id AND u.role = 'admin';
      CREATE INDEX charges_by_creator ON charges (created_by, created_at DESC);
    `,
  },
  {
    id: 3,
    name: 'cuenta de pey propia por negocio',
    sql: `
      ALTER TABLE merchants ADD COLUMN pey_key_sealed TEXT;
      ALTER TABLE merchants ADD COLUMN pey_key_last4 TEXT;
      ALTER TABLE merchants ADD COLUMN pey_webhook_token TEXT UNIQUE;
      ALTER TABLE merchants ADD COLUMN pey_webhook_secret_sealed TEXT;
      ALTER TABLE merchants ADD COLUMN pey_connected_at BIGINT;
      ALTER TABLE merchants ADD COLUMN pey_last_event_at BIGINT;

      -- Con qué API key se creó cada cobro: NULL es la del proyecto. Las
      -- consultas y los webhooks de un cobro siempre usan esa misma llave.
      ALTER TABLE charges ADD COLUMN pey_merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL;
      CREATE INDEX charges_by_pey_account ON charges (pey_merchant_id, status) WHERE pey_merchant_id IS NOT NULL;
    `,
  },
];

export const TABLES = ['demo_messages', 'demo_sessions', 'rate_limits', 'events', 'charges', 'sessions', 'users', 'merchants'];

/** Aplica las migraciones pendientes. Es seguro llamarla en cada arranque y desde varias instancias. */
export async function migrate(db) {
  await db.transaction(async (tx) => {
    // Un candado de transacción evita que dos instancias migren al mismo tiempo.
    await tx.query('SELECT pg_advisory_xact_lock(717171)');
    await tx.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at BIGINT NOT NULL)',
    );
    const applied = new Set((await tx.query('SELECT id FROM schema_migrations')).map((row) => row.id));
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, $3)', [
        migration.id,
        migration.name,
        Date.now(),
      ]);
    }
  });
}
