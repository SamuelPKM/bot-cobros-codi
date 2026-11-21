import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';
import { DataSource } from 'typeorm';
import { PeyError } from '../src/modules/pey/errors/pey.error';
import { FakePeyClientFactory } from './fakes/fake-pey-client-factory';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
  TEST_WEBHOOK_SECRET,
} from './utils/test-app';

const registration = (overrides: object = {}) => ({
  businessName: 'Tacos Ana',
  adminName: 'Ana López',
  username: 'ana',
  password: 'ana-12345',
  peyApiKey: 'pey_live_ana_1234',
  ...overrides,
});

describe('Negocios con su propia API key de pey (e2e)', () => {
  let app: INestApplication;
  let peyFactory: FakePeyClientFactory;
  let http: ReturnType<typeof request>;
  let db: DataSource;

  beforeAll(async () => {
    ({ app, peyFactory } = await createTestApp());
    http = request(app.getHttpServer());
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    peyFactory.reset();
  });

  describe('POST /businesses (registro público)', () => {
    it('crea el negocio y su admin, valida la API key con pey y abre sesión', async () => {
      const res = await http
        .post('/businesses')
        .send(registration())
        .expect(201);

      expect(peyFactory.keysUsedFor('verifyApiKey')).toEqual([
        'pey_live_ana_1234',
      ]);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
        user: {
          username: 'ana',
          name: 'Ana López',
          role: 'admin',
          businessId: expect.any(Number),
        },
        business: {
          name: 'Tacos Ana',
          peyApiKeyLast4: '1234',
          webhookConfigured: false,
          webhookUrl: expect.stringMatching(
            /^https:\/\/cobrale-api\.test\/webhooks\/pey\/[\w-]{20,}$/,
          ),
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('pey_live_ana');

      const me = await http
        .get('/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body.user.role).toBe('admin');
    });

    it('guarda la API key cifrada, nunca en claro', async () => {
      await http.post('/businesses').send(registration()).expect(201);
      const rows = await db.query<Record<string, unknown>[]>(
        `SELECT * FROM businesses`,
      );
      expect(JSON.stringify(rows)).not.toContain('pey_live_ana_1234');
    });

    it('rechaza una API key que pey no reconoce, sin crear nada', async () => {
      peyFactory.invalidKeys.add('pey_live_mala_0000');
      const res = await http
        .post('/businesses')
        .send(registration({ peyApiKey: 'pey_live_mala_0000' }))
        .expect(400);
      expect(res.body.message).toMatch(/API key de pey no es válida/);
      expect(await db.query(`SELECT 1 FROM businesses`)).toHaveLength(0);
      expect(await db.query(`SELECT 1 FROM users`)).toHaveLength(0);
    });

    it('si pey no responde al validar, responde 502 y no crea nada', async () => {
      peyFactory.failNextValidation(
        new PeyError('down', { type: 'NETWORK_ERROR' }),
      );
      await http.post('/businesses').send(registration()).expect(502);
      expect(await db.query(`SELECT 1 FROM businesses`)).toHaveLength(0);
    });

    it('si el usuario ya existe responde 409 y no deja un negocio huérfano', async () => {
      await http.post('/businesses').send(registration()).expect(201);
      await http
        .post('/businesses')
        .send(
          registration({
            businessName: 'Otro',
            peyApiKey: 'pey_live_otro_9999',
          }),
        )
        .expect(409);
      expect(await db.query(`SELECT 1 FROM businesses`)).toHaveLength(1);
    });

    it.each([
      { businessName: 'x'.repeat(31) },
      { businessName: '' },
      { peyApiKey: '' },
      { password: 'corta' },
      { username: 'a' },
      { role: 'seller' },
    ])('responde 400 a %j', async (overrides) => {
      await http.post('/businesses').send(registration(overrides)).expect(400);
      expect(peyFactory.calls).toHaveLength(0);
    });

    it('limita los registros por IP', async () => {
      for (let i = 0; i < 5; i++) {
        await http
          .post('/businesses')
          .set('X-Forwarded-For', '203.0.113.5')
          .send(
            registration({
              username: `user${i}`,
              peyApiKey: `pey_live_key_${i}000`,
            }),
          )
          .expect(201);
      }
      await http
        .post('/businesses')
        .set('X-Forwarded-For', '203.0.113.5')
        .send(
          registration({ username: 'user9', peyApiKey: 'pey_live_key_9000' }),
        )
        .expect(429);
    });
  });

  describe('GET y PATCH /businesses/me (solo admin)', () => {
    let admin: string;
    let seller: string;

    beforeEach(async () => {
      const business = await seedBusiness(app, { webhookSecret: null });
      await seedUser(app, business.id, {
        username: 'leo',
        password: 'leo-12345',
      });
      admin = await loginAs(app, 'dueno', 'admin-12345');
      seller = await loginAs(app, 'leo', 'leo-12345');
      // Registrar el negocio ya validó su key: cada prueba cuenta solo sus llamadas.
      peyFactory.calls.length = 0;
    });

    it('el admin ve su negocio sin secretos', async () => {
      const res = await http
        .get('/businesses/me')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body.business).toMatchObject({
        name: 'Tacos Ana',
        webhookConfigured: false,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/pey_key_|whsec_/);
    });

    it('el admin cambia el nombre, la API key (validada) y registra el secreto del webhook', async () => {
      const res = await http
        .patch('/businesses/me')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          name: 'Tacos Ana Centro',
          peyApiKey: 'pey_live_nueva_5678',
          peyWebhookSecret: TEST_WEBHOOK_SECRET,
        })
        .expect(200);
      expect(res.body.business).toMatchObject({
        name: 'Tacos Ana Centro',
        peyApiKeyLast4: '5678',
        webhookConfigured: true,
      });
      expect(peyFactory.keysUsedFor('verifyApiKey')).toEqual([
        'pey_live_nueva_5678',
      ]);
      expect(JSON.stringify(res.body)).not.toMatch(/pey_live_nueva|whsec_/);
    });

    it('no acepta una API key nueva inválida ni un secreto que no sea whsec_', async () => {
      peyFactory.invalidKeys.add('pey_live_mala_0000');
      await http
        .patch('/businesses/me')
        .set('Authorization', `Bearer ${admin}`)
        .send({ peyApiKey: 'pey_live_mala_0000' })
        .expect(400);
      await http
        .patch('/businesses/me')
        .set('Authorization', `Bearer ${admin}`)
        .send({ peyWebhookSecret: 'otro' })
        .expect(400);
      const res = await http
        .get('/businesses/me')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body.business.peyApiKeyLast4).toBe('ueno');
    });

    it('un vendedor no ve ni cambia los datos del negocio', async () => {
      await http
        .get('/businesses/me')
        .set('Authorization', `Bearer ${seller}`)
        .expect(403);
      await http
        .patch('/businesses/me')
        .set('Authorization', `Bearer ${seller}`)
        .send({ name: 'X' })
        .expect(403);
      await http.get('/businesses/me').expect(401);
    });
  });

  describe('aislamiento entre negocios', () => {
    it('cada negocio cobra con SU API key y su nombre, y no ve nada del otro', async () => {
      const ana = await seedBusiness(app, {
        name: 'Tacos Ana',
        adminUsername: 'ana',
        apiKey: 'pey_key_ana_aaaa',
      });
      await seedBusiness(app, {
        name: 'Barbería Leo',
        adminUsername: 'leo',
        apiKey: 'pey_key_leo_bbbb',
      });
      await seedUser(app, ana.id, {
        username: 'vendedora',
        password: 'vende-12345',
      });
      const anaAdmin = await loginAs(app, 'ana', 'admin-12345');
      const leoAdmin = await loginAs(app, 'leo', 'admin-12345');
      const anaSeller = await loginAs(app, 'vendedora', 'vende-12345');

      await http
        .post('/charges')
        .set('Authorization', `Bearer ${anaSeller}`)
        .send({ phone: '5512345678', amount: 10 })
        .expect(201);
      expect(peyFactory.keysUsedFor('createPush')).toEqual([
        'pey_key_ana_aaaa',
      ]);
      expect(peyFactory.client.pushes[0].concept).toBe('Tacos Ana');

      await http
        .post('/charges')
        .set('Authorization', `Bearer ${leoAdmin}`)
        .send({ phone: '5598765432', amount: 20 })
        .expect(201);
      expect(peyFactory.keysUsedFor('createPush')).toEqual([
        'pey_key_ana_aaaa',
        'pey_key_leo_bbbb',
      ]);
      expect(peyFactory.client.pushes[1].concept).toBe('Barbería Leo');

      const leoCharges = await http
        .get('/charges')
        .set('Authorization', `Bearer ${leoAdmin}`)
        .expect(200);
      expect(
        leoCharges.body.charges.map((c: { amount: number }) => c.amount),
      ).toEqual([20]);
      await http
        .get('/charges/1')
        .set('Authorization', `Bearer ${leoAdmin}`)
        .expect(404);
      await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${leoAdmin}`)
        .expect(404);

      const leoTeam = await http
        .get('/users')
        .set('Authorization', `Bearer ${leoAdmin}`)
        .expect(200);
      // Su equipo es solo él: no ve a nadie del negocio de Ana.
      expect(
        leoTeam.body.users.map((u: { username: string }) => u.username),
      ).toEqual(['leo']);
      const sellerId = (
        await http
          .get('/users')
          .set('Authorization', `Bearer ${anaAdmin}`)
          .expect(200)
      ).body.users.find((u: { role: string }) => u.role === 'seller')
        .id as number;
      await http
        .patch(`/users/${sellerId}`)
        .set('Authorization', `Bearer ${leoAdmin}`)
        .send({ active: false })
        .expect(404);
    });

    it('el admin también puede cobrar en su negocio', async () => {
      await seedBusiness(app);
      const admin = await loginAs(app, 'dueno', 'admin-12345');
      await http
        .post('/charges')
        .set('Authorization', `Bearer ${admin}`)
        .send({ phone: '5512345678', amount: 10 })
        .expect(201);
    });

    it('el vendedor nuevo queda en el negocio de quien lo da de alta', async () => {
      const business = await seedBusiness(app);
      const admin = await loginAs(app, 'dueno', 'admin-12345');
      const res = await http
        .post('/users')
        .set('Authorization', `Bearer ${admin}`)
        .send({ username: 'nuevo', name: 'Nuevo', password: 'nuevo-12345' })
        .expect(201);
      expect(res.body.user.businessId).toBe(business.id);
    });
  });

  describe('webhook por negocio', () => {
    function deliver(
      slug: string,
      payload: object,
      secret = TEST_WEBHOOK_SECRET,
      id = `msg_${Date.now()}_${Math.random()}`,
    ) {
      const body = JSON.stringify(payload);
      const at = new Date();
      return http
        .post(`/webhooks/pey/${slug}`)
        .set('content-type', 'application/json')
        .set('webhook-id', id)
        .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
        .set('webhook-signature', new Webhook(secret).sign(id, at, body))
        .send(body);
    }

    it('verifica con el secreto de ESE negocio y consulta pey con SU API key', async () => {
      const business = await seedBusiness(app, { apiKey: 'pey_key_ana_aaaa' });
      const admin = await loginAs(app, 'dueno', 'admin-12345');
      await http
        .post('/charges')
        .set('Authorization', `Bearer ${admin}`)
        .send({ phone: '5512345678', amount: 10 })
        .expect(201);
      peyFactory.client.pay('TX1');

      const res = await deliver(business.webhookSlug, {
        type: 'codi.pn.payment_received',
        transactionId: 'TX1',
      }).expect(200);
      expect(res.body.result).toBe('paid');
      expect(peyFactory.keysUsedFor('getTransaction')).toEqual([
        'pey_key_ana_aaaa',
      ]);
    });

    it('rechaza la firma hecha con el secreto de otro negocio', async () => {
      const ana = await seedBusiness(app, { adminUsername: 'ana' });
      const otherSecret = 'whsec_b3Ryb3NlY3JldG9kaXN0aW50bw==';
      await deliver(
        ana.webhookSlug,
        { type: 'bank_account.updated' },
        otherSecret,
      ).expect(401);
    });

    it('no confunde pagos: un negocio no puede marcar pagado el cobro de otro', async () => {
      await seedBusiness(app, { adminUsername: 'ana' });
      const leo = await seedBusiness(app, {
        adminUsername: 'leo',
        name: 'Leo',
      });
      const anaAdmin = await loginAs(app, 'ana', 'admin-12345');
      await http
        .post('/charges')
        .set('Authorization', `Bearer ${anaAdmin}`)
        .send({ phone: '5512345678', amount: 10 })
        .expect(201);
      peyFactory.client.pay('TX1');

      const res = await deliver(leo.webhookSlug, {
        type: 'codi.pn.payment_received',
        transactionId: 'TX1',
      }).expect(200);
      expect(res.body.result).toBe('unknown_charge');
      const charge = await http
        .get('/charges/1')
        .set('Authorization', `Bearer ${anaAdmin}`)
        .expect(200);
      expect(charge.body.charge.status).toBe('pending');
    });

    it('responde 404 a un negocio que no existe y 503 si aún no registra su secreto', async () => {
      await deliver('no-existe', { type: 'bank_account.updated' }).expect(404);
      const business = await seedBusiness(app, { webhookSecret: null });
      await deliver(business.webhookSlug, {
        type: 'bank_account.updated',
      }).expect(503);
    });
  });
});
