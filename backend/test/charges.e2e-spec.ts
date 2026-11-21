import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PeyError } from '../src/modules/pey/errors/pey.error';
import { FakePeyClient } from './fakes/fake-pey-client';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

describe('Cobros: push con QR de respaldo (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let http: ReturnType<typeof request>;
  let ana: string;
  let leo: string;
  let admin: string;

  beforeAll(async () => {
    ({ app, pey } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    pey.reset();
    // Negocio "Cóbrale" con su admin "dueno" y dos vendedores.
    const business = await seedBusiness(app, { name: 'Cóbrale' });
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
      maxAmountCents: 50_000,
    });
    await seedUser(app, business.id, {
      username: 'leo',
      name: 'Leo',
      password: 'leo-12345',
    });
    ana = await loginAs(app, 'ana', 'ana-12345');
    leo = await loginAs(app, 'leo', 'leo-12345');
    admin = await loginAs(app, 'dueno', 'admin-12345');
  });

  const charge = (token: string, body: object) =>
    http.post('/charges').set('Authorization', `Bearer ${token}`).send(body);

  const setChargeStatus = (id: number, status: string) =>
    app
      .get(DataSource)
      .query(`UPDATE charges SET status = $1 WHERE id = $2`, [status, id]);

  describe('POST /charges (push)', () => {
    it('crea el cobro y manda el push CoDi al celular del cliente', async () => {
      const res = await charge(ana, {
        phone: '5512345678',
        amount: 150.5,
        concept: 'Orden 12',
      }).expect(201);

      expect(res.body.charge).toMatchObject({
        id: 1,
        status: 'pending',
        amount: 150.5,
        concept: 'Orden 12',
        payerPhone: '5512345678',
        seller: { id: expect.any(Number), name: 'Ana' },
        paidAt: null,
        paidVia: null,
      });
      expect(res.body.charge.attempts).toEqual([
        {
          id: expect.any(Number),
          kind: 'push',
          status: 'pending',
          expiresAt: expect.any(String),
          error: null,
          qrString: null,
          linkUrl: null,
        },
      ]);
      const expiresIn =
        Date.parse(res.body.charge.attempts[0].expiresAt) - Date.now();
      expect(expiresIn).toBeGreaterThan(340_000);
      expect(expiresIn).toBeLessThanOrEqual(360_000);

      expect(pey.pushes).toEqual([
        {
          amount: 150.5,
          phoneNumber: '5512345678',
          concept: 'Cóbrale: Orden 12',
          expiration: 360,
          numRef: '1',
          metadata: { chargeId: '1' },
        },
      ]);
    });

    it.each([
      { phone: '551234567', amount: 10 },
      { phone: '+525512345678', amount: 10 },
      { phone: '5512345678', amount: 0 },
      { phone: '5512345678', amount: 1.234 },
      { phone: '5512345678', amount: 1_000_001 },
      { phone: '5512345678', amount: 10, concept: 'x'.repeat(41) },
      { phone: '5512345678', amount: 10, sellerId: 99 },
    ])('responde 400 a %j sin llamar a pey', async (body) => {
      await charge(ana, body).expect(400);
      expect(pey.pushes).toHaveLength(0);
    });

    it('respeta el tope por cobro del vendedor', async () => {
      const res = await charge(ana, {
        phone: '5512345678',
        amount: 500.01,
      }).expect(422);
      expect(res.body.message).toMatch(/500/);
      expect(pey.pushes).toHaveLength(0);
      await charge(ana, { phone: '5512345678', amount: 500 }).expect(201);
    });

    it('no manda más de 3 push por hora al mismo celular, de ningún vendedor', async () => {
      await charge(ana, { phone: '5512345678', amount: 1 }).expect(201);
      await charge(ana, { phone: '5512345678', amount: 1 }).expect(201);
      await charge(leo, { phone: '5512345678', amount: 1 }).expect(201);
      await charge(leo, { phone: '5512345678', amount: 1 }).expect(429);
      expect(pey.pushes).toHaveLength(3);
      await charge(leo, { phone: '5598765432', amount: 1 }).expect(201);
    });

    it('si pey rechaza el push, el cobro sigue pendiente para cobrarlo con QR', async () => {
      pey.failNext(
        new PeyError('account is not active', {
          type: 'INVALID_STATE',
          status: 400,
        }),
      );
      const res = await charge(ana, { phone: '5512345678', amount: 10 }).expect(
        201,
      );
      expect(res.body.charge.status).toBe('pending');
      expect(res.body.charge.attempts[0]).toMatchObject({
        kind: 'push',
        status: 'failed',
        error: expect.stringMatching(/no está activa/),
      });
    });

    it('si pey no contesta, el intento queda "unknown" y nunca se reintenta', async () => {
      pey.failNext(new PeyError('timeout', { type: 'TIMEOUT' }));
      const res = await charge(ana, { phone: '5512345678', amount: 10 }).expect(
        201,
      );
      expect(res.body.charge.attempts[0]).toMatchObject({
        status: 'unknown',
        error: expect.stringMatching(/no lo repitas/i),
      });
      expect(pey.pushes).toHaveLength(1);
    });

    it('el admin también cobra, y todo exige Bearer token', async () => {
      await charge(admin, { phone: '5512345678', amount: 10 }).expect(201);
      await http
        .post('/charges')
        .send({ phone: '5512345678', amount: 10 })
        .expect(401);
      await http.get('/charges').expect(401);
    });
  });

  describe('POST /charges/:id/qr (plan B)', () => {
    it('genera un QR del mismo cobro con 15 minutos de vigencia', async () => {
      await charge(ana, {
        phone: '5512345678',
        amount: 80,
        concept: 'Café',
      }).expect(201);

      const res = await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);

      expect(res.body.qr).toEqual({
        qrString: '{"TYP":1,"v":"01","IDC":"IDC1"}',
        expiresAt: expect.any(String),
      });
      const expiresIn = Date.parse(res.body.qr.expiresAt) - Date.now();
      expect(expiresIn).toBeGreaterThan(880_000);
      expect(expiresIn).toBeLessThanOrEqual(900_000);
      expect(
        res.body.charge.attempts.map((a: { kind: string }) => a.kind),
      ).toEqual(['push', 'qr']);
      expect(pey.qrs).toEqual([
        {
          amount: 80,
          concept: 'Cóbrale: Café',
          expiration: 900,
          numRef: '1',
          metadata: { chargeId: '1' },
        },
      ]);
    });

    it('si ya hay un QR vigente devuelve el mismo, sin crear otro', async () => {
      await charge(ana, { phone: '5512345678', amount: 80 }).expect(201);
      const first = await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      const second = await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      expect(second.body.qr).toEqual(first.body.qr);
      expect(pey.qrs).toHaveLength(1);
    });

    it('responde 409 si el cobro ya no está pendiente', async () => {
      await charge(ana, { phone: '5512345678', amount: 80 }).expect(201);
      await setChargeStatus(1, 'paid');
      await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(409);
      expect(pey.qrs).toHaveLength(0);
    });

    it('responde 404 con el cobro de otro vendedor o uno que no existe', async () => {
      await charge(ana, { phone: '5512345678', amount: 80 }).expect(201);
      await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${leo}`)
        .expect(404);
      await http
        .post('/charges/999/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(404);
    });

    it('si pey falla al crear el QR responde 502 con el motivo', async () => {
      await charge(ana, { phone: '5512345678', amount: 80 }).expect(201);
      pey.failNext(
        new PeyError('maintenance', {
          type: 'SERVICE_UNAVAILABLE',
          status: 503,
        }),
      );
      const res = await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(502);
      expect(res.body.message).toMatch(/mantenimiento/);
    });
  });

  describe('GET /charges y GET /charges/:id', () => {
    it('el vendedor ve solo sus cobros, el más reciente primero', async () => {
      await charge(ana, { phone: '5512345678', amount: 1 }).expect(201);
      await charge(leo, { phone: '5598765432', amount: 2 }).expect(201);
      await charge(ana, { phone: '5511112222', amount: 3 }).expect(201);

      const res = await http
        .get('/charges')
        .set('Authorization', `Bearer ${ana}`)
        .expect(200);
      expect(res.body.charges.map((c: { amount: number }) => c.amount)).toEqual(
        [3, 1],
      );
    });

    it('el admin ve los cobros de todos y puede filtrar por vendedor', async () => {
      await charge(ana, { phone: '5512345678', amount: 1 }).expect(201);
      await charge(leo, { phone: '5598765432', amount: 2 }).expect(201);

      const all = await http
        .get('/charges')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(all.body.charges.map((c: { amount: number }) => c.amount)).toEqual(
        [2, 1],
      );

      const leoId = all.body.charges[0].seller.id as number;
      const onlyLeo = await http
        .get(`/charges?sellerId=${leoId}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(
        onlyLeo.body.charges.map((c: { amount: number }) => c.amount),
      ).toEqual([2]);
    });

    it('limita la lista y valida los filtros', async () => {
      for (let i = 1; i <= 3; i++)
        await charge(ana, { phone: `551234567${i}`, amount: i }).expect(201);
      const res = await http
        .get('/charges?limit=2')
        .set('Authorization', `Bearer ${ana}`)
        .expect(200);
      expect(res.body.charges).toHaveLength(2);
      await http
        .get('/charges?limit=500')
        .set('Authorization', `Bearer ${ana}`)
        .expect(400);
      await http
        .get('/charges?status=raro')
        .set('Authorization', `Bearer ${ana}`)
        .expect(400);
    });

    it('el detalle de un cobro ajeno responde 404 al vendedor y 200 al admin', async () => {
      await charge(ana, { phone: '5512345678', amount: 1 }).expect(201);
      await http
        .get('/charges/1')
        .set('Authorization', `Bearer ${leo}`)
        .expect(404);
      const res = await http
        .get('/charges/1')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body.charge.seller.name).toBe('Ana');
    });
  });
});
