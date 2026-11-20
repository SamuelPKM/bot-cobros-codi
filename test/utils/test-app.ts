import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { typeOrmOptions } from '../../src/database/data-source';
import { configureApp } from '../../src/main';
import { PeyClient } from '../../src/modules/pey/services/pey-client.service';
import { FakePeyClient } from '../fakes/fake-pey-client';

export interface TestApp {
  app: INestApplication;
  /** pey simulado: ninguna prueba e2e llama a la API real. */
  pey: FakePeyClient;
}

/**
 * Levanta la app completa contra la base de pruebas (ver test/setup-env.ts).
 * El esquema se recrea con las migraciones ANTES de arrancar, como en producción.
 */
export async function createTestApp(): Promise<TestApp> {
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

  const pey = new FakePeyClient();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PeyClient)
    .useValue(pey)
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, pey };
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

/** Inicia sesión y devuelve el Bearer token. */
export async function loginAs(
  app: INestApplication,
  username: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}
