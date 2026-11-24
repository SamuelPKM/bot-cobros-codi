import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { typeOrmOptions } from '../../src/database/data-source';
import { configureApp } from '../../src/main';
import { BusinessesService } from '../../src/modules/businesses/services/businesses.service';
import { ExpoPushClient } from '../../src/modules/notifications/services/expo-push-client.service';
import { PeyClientFactory } from '../../src/modules/pey/services/pey-client.factory';
import { UsersService } from '../../src/modules/users/services/users.service';
import type { Role } from '../../src/modules/users/types/role.type';
import { WhatsAppClient } from '../../src/modules/whatsapp/services/whatsapp-client.service';
import { FakeExpoPushClient } from '../fakes/fake-expo-push-client';
import { FakeWhatsAppClient } from '../fakes/fake-whatsapp-client';
import type { FakePeyClient } from '../fakes/fake-pey-client';
import { FakePeyClientFactory } from '../fakes/fake-pey-client-factory';
import { FakeLogoStorage } from '../fakes/fake-logo-storage';
import { LogoStorage } from '../../src/modules/businesses/storage/logo-storage';

export interface TestApp {
  app: INestApplication;
  /** pey simulado que comparten todos los negocios: ninguna prueba llama a la API real. */
  pey: FakePeyClient;
  /** Registra la API key de cada llamada a pey. */
  peyFactory: FakePeyClientFactory;
  /** Expo Push simulado. */
  expo: FakeExpoPushClient;
  /** WhatsApp Cloud API simulado. */
  whatsapp: FakeWhatsAppClient;
  /** Bucket de logos en memoria. */
  logos: FakeLogoStorage;
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

  const peyFactory = new FakePeyClientFactory();
  const expo = new FakeExpoPushClient();
  const whatsapp = new FakeWhatsAppClient();
  const logos = new FakeLogoStorage();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PeyClientFactory)
    .useValue(peyFactory)
    .overrideProvider(ExpoPushClient)
    .useValue(expo)
    .overrideProvider(WhatsAppClient)
    .useValue(whatsapp)
    .overrideProvider(LogoStorage)
    .useValue(logos)
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, pey: peyFactory.client, peyFactory, expo, whatsapp, logos };
}

/** Olvida los intentos contados por los límites (cada prueba empieza de cero). */
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

export const TEST_WEBHOOK_SECRET = process.env.TEST_WEBHOOK_SECRET!;

export interface SeededBusiness {
  id: number;
  name: string;
  webhookSlug: string;
  apiKey: string;
}

/**
 * Registra un negocio con su admin (como POST /businesses) y le configura el
 * secreto de webhook de pruebas.
 */
export async function seedBusiness(
  app: INestApplication,
  options: {
    name?: string;
    adminUsername?: string;
    adminPassword?: string;
    apiKey?: string;
    webhookSecret?: string | null;
  } = {},
): Promise<SeededBusiness> {
  const name = options.name ?? 'Tacos Ana';
  const adminUsername = options.adminUsername ?? 'dueno';
  const adminPassword = options.adminPassword ?? 'admin-12345';
  const apiKey = options.apiKey ?? `pey_key_${adminUsername}`;
  const webhookSecret =
    options.webhookSecret === undefined
      ? TEST_WEBHOOK_SECRET
      : options.webhookSecret;
  const businesses = app.get(BusinessesService);
  const { business } = await businesses.register({
    businessName: name,
    adminName: 'Dueño',
    username: adminUsername,
    password: adminPassword,
    peyApiKey: apiKey,
  });
  if (webhookSecret)
    await businesses.update(business.id, { peyWebhookSecret: webhookSecret });
  return { id: business.id, name, webhookSlug: business.webhookSlug, apiKey };
}

/** Crea una persona del negocio directamente (sin pasar por HTTP). */
export function seedUser(
  app: INestApplication,
  businessId: number,
  {
    username,
    password,
    role = 'seller',
    name = username,
    maxAmountCents = null,
  }: {
    username: string;
    password: string;
    role?: Role;
    name?: string;
    maxAmountCents?: number | null;
  },
) {
  return app
    .get(UsersService)
    .create({ businessId, username, password, role, name, maxAmountCents });
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
