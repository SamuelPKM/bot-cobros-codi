// Conexión a Postgres con una sola interfaz para dos motores:
//
//  - Con DATABASE_URL: un pool de `pg` (producción, por ejemplo Neon). Varias
//    instancias del servidor pueden compartir la misma base.
//  - Sin DATABASE_URL: PGlite, un Postgres real que corre dentro de Node.
//    Sirve para desarrollo local y pruebas sin instalar nada. Con `dataDir`
//    guarda en disco; sin él, vive en memoria.
//
// Las dos ofrecen lo mismo:
//   query(sql, params) -> filas
//   one(sql, params)   -> la primera fila o null
//   exec(sql)          -> varias sentencias sin parámetros (migraciones)
//   transaction(fn)    -> fn recibe un objeto con query/one dentro de BEGIN/COMMIT
//   withLock(key, fn)  -> corre fn solo si nadie más tiene el candado; si no, devuelve false
//   close()

import { PGlite, types as pgliteTypes } from '@electric-sql/pglite';
import pg from 'pg';

const INT8 = 20; // bigint: fechas en milisegundos y COUNT(*). Se devuelven como número.

function wrap(run, exec) {
  return {
    exec,
    async query(sql, params = []) {
      return (await run(sql, params)).rows;
    },
    async one(sql, params = []) {
      return (await run(sql, params)).rows[0] ?? null;
    },
  };
}

function openPg(url, { max = 10 } = {}) {
  const pool = new pg.Pool({
    connectionString: url,
    max,
    // No mantiene vivo el proceso cuando no hay consultas (scripts y pruebas).
    allowExitOnIdle: true,
    types: { getTypeParser: (oid, format) => (oid === INT8 ? Number : pg.types.getTypeParser(oid, format)) },
  });
  pool.on('error', (error) => console.error(`[db] error en una conexión inactiva: ${error.message}`));

  return {
    ...wrap((sql, params) => pool.query(sql, params), (sql) => pool.query(sql)),
    engine: 'postgres',

    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap((sql, params) => client.query(sql, params), (sql) => client.query(sql)));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    // Los candados de sesión de Postgres viven en una conexión: se toma y se
    // suelta en la misma.
    async withLock(key, fn) {
      const client = await pool.connect();
      try {
        const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
        if (!rows[0].ok) return false;
        try {
          await fn();
        } finally {
          await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {});
        }
        return true;
      } finally {
        client.release();
      }
    },

    close: () => pool.end(),
  };
}

async function openPglite(dataDir) {
  const db = new PGlite(dataDir, { parsers: { [pgliteTypes.INT8]: Number } });
  await db.waitReady;
  let locked = false; // PGlite tiene una sola conexión: basta un candado en memoria.

  return {
    ...wrap((sql, params) => db.query(sql, params), (sql) => db.exec(sql)),
    engine: 'pglite',

    transaction: (fn) => db.transaction((tx) => fn(wrap((sql, params) => tx.query(sql, params), (sql) => tx.exec(sql)))),

    async withLock(_key, fn) {
      if (locked) return false;
      locked = true;
      try {
        await fn();
      } finally {
        locked = false;
      }
      return true;
    },

    close: () => db.close(),
  };
}

/** @param url DATABASE_URL de Postgres. Sin ella se usa PGlite en `dataDir` (o en memoria). */
export async function connect({ url = null, dataDir = undefined } = {}) {
  return url ? openPg(url) : openPglite(dataDir);
}
