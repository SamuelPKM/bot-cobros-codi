import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { typeOrmOptions } from '../../src/database/data-source';
import { configureApp } from '../../src/main';

/**
 * Levanta la app completa contra la base de pruebas (ver test/setup-env.ts).
 * El esquema se recrea con las migraciones ANTES de arrancar, como en producción.
 */
export async function createTestApp(): Promise<INestApplication> {
  const migrator = new DataSource(
    typeOrmOptions({
      DATABASE_URL: process.env.DATABASE_URL!,
      DATABASE_SSL: false,
    }),
  );
  await migrator.initialize();
  await migrator.dropDatabase();
  await migrator.runMigrations();
  await migrator.destroy();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

/** Olvida los intentos contados por el límite de login (cada prueba empieza de cero). */
export function resetThrottling(app: INestApplication): void {
  app.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear();
}

/** Vacía todas las tablas de la app entre pruebas. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas
    .map((meta) => `"${meta.tableName}"`)
    .join(', ');
  if (tables)
    await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}
