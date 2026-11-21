// Opciones de TypeORM compartidas por la app y por la CLI de migraciones.
// `synchronize` siempre apagado: el esquema solo cambia con migraciones versionadas.

import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Env } from '../config/env.validation';

export function typeOrmOptions(
  env: Pick<Env, 'DATABASE_URL' | 'DATABASE_SSL'>,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
  };
}

/** DataSource para `npm run migration:*` (lee DATABASE_URL y DATABASE_SSL del entorno). */
export default new DataSource(
  typeOrmOptions({
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgres://cobrale:cobrale@localhost:5433/cobrale',
    DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  }),
);
