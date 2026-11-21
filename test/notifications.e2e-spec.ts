import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';
import { DataSource } from 'typeorm';
import { SweeperService } from '../src/modules/sweeper/services/sweeper.service';
import { UsersService } from '../src/modules/users/services/users.service';
import { FakeExpoPushClient } from './fakes/fake-expo-push-client';
import { FakePeyClient } from './fakes/fake-pey-client';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
  TEST_WEBHOOK_SECRET,
} from './utils/test-app';

const SECRET = TEST_WEBHOOK_SECRET;
const ANA_DEVICE = 'ExponentPushToken[ana-celular]';
const ADMIN_DEVICE = 'ExponentPushToken[dueno-celular]';

describe('Notificaciones de pago con Expo Push (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let expo: FakeExpoPushClient;
  let http: ReturnType<typeof request>;
  let ana: string;
  let admin: string;
  let webhookPath: string;
  let counter = 0;

  beforeAll(async () => {
    ({ app, pey, expo } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    pey.reset();
    expo.reset();
    const business = await seedBusiness(app);
    webhookPath = `/webhooks/pey/${business.webhookSlug}`;
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
    });
    ana = await loginAs(app, 'ana', 'ana-12345');
    admin = await loginAs(app, 'dueno', 'admin-12345');
  });

  const registerDevice = (token: string, device: string) =>
    http
      .post('/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: device });

  function deliver(payload: object, id = `msg_${++counter}`) {
    const body = JSON.stringify(payload);
    const at = new Date();
    return http
      .post(webhookPath)
      .set('content-type', 'application/json')
      .set('webhook-id', id)
      .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
      .set('webhook-signature', new Webhook(SECRET).sign(id, at, body))
      .send(body);
  }

  /** Crea un cobro, lo paga en pey y entrega el webhook (espera 200). */
  async function paidCharge(concept = 'Orden 12') {
    await http
      .post('/charges')
      .set('Authorization', `Bearer ${ana}`)
      .send({ phone: '5512345678', amount: 150.5, concept })
      .expect(201);
    pey.pay('TX1');
    return deliver({
      type: 'codi.pn.payment_received',
      transactionId: 'TX1',
    }).expect(200);
  }

  async function notifiedAt(): Promise<Date | null> {
    const rows = await app
      .get(DataSource)
      .query<{ notified_at: Date | null }[]>(
        `SELECT notified_at FROM charges WHERE id = 1`,
      );
    return rows[0].notified_at;
  }

  describe('POST /push-tokens y DELETE /push-tokens', () => {
    it('registra el dispositivo del usuario', async () => {
      await registerDevice(ana, ANA_DEVICE).expect(204);
    });

    it('rechaza algo que no es un token de Expo y exige sesión', async () => {
      await registerDevice(ana, 'https://evil.example').expect(400);
      await http.post('/push-tokens').send({ token: ANA_DEVICE }).expect(401);
    });

    it('si el dispositivo cambia de usuario, el aviso le llega al nuevo', async () => {
      await registerDevice(admin, ANA_DEVICE).expect(204);
      await registerDevice(ana, ANA_DEVICE).expect(204);
      await paidCharge();
      expect(expo.sent.map((m) => m.to)).toEqual([ANA_DEVICE]);
    });

    it('al cerrar sesión borra el token, solo si es del usuario', async () => {
      await registerDevice(ana, ANA_DEVICE).expect(204);
      await http
        .delete('/push-tokens')
        .set('Authorization', `Bearer ${admin}`)
        .send({ token: ANA_DEVICE })
        .expect(204);
      await http
        .delete('/push-tokens')
        .set('Authorization', `Bearer ${ana}`)
        .send({ token: ANA_DEVICE })
        .expect(204);
      await paidCharge();
      expect(expo.sent).toHaveLength(0);
    });
  });

  describe('aviso de pago', () => {
    it('avisa al vendedor y a los admins en cuanto se paga, una sola vez', async () => {
      await registerDevice(ana, ANA_DEVICE).expect(204);
      await registerDevice(admin, ADMIN_DEVICE).expect(204);

      await paidCharge();

      expect(expo.sent).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            to: ANA_DEVICE,
            title: 'Pago recibido',
            body: '$150.50 · Ana · Orden 12',
          }),
          expect.objectContaining({
            to: ADMIN_DEVICE,
            data: { chargeId: 1, type: 'charge.paid' },
          }),
        ]),
      );
      expect(expo.sent).toHaveLength(2);
      expect(await notifiedAt()).not.toBeNull();

      await deliver({
        type: 'codi.pn.payment_received',
        transactionId: 'TX1',
      }).expect(200);
      expect(expo.sent).toHaveLength(2);
    });

    it('nunca avisa a los admins de otro negocio', async () => {
      await seedBusiness(app, {
        name: 'Otro negocio',
        adminUsername: 'otro',
        webhookSecret: null,
      });
      const otro = await loginAs(app, 'otro', 'admin-12345');
      await registerDevice(otro, 'ExponentPushToken[otro-negocio]').expect(204);
      await registerDevice(ana, ANA_DEVICE).expect(204);

      await paidCharge();

      expect(expo.sent.map((m) => m.to)).toEqual([ANA_DEVICE]);
    });

    it('no avisa a un admin desactivado', async () => {
      await registerDevice(admin, ADMIN_DEVICE).expect(204);
      const dueno = await app.get(UsersService).findByUsername('dueno');
      await app.get(UsersService).update(dueno!.id, { active: false });
      await paidCharge();
      expect(expo.sent).toHaveLength(0);
    });

    it('si Expo falla, el pago queda registrado y el barrido reintenta el aviso', async () => {
      await registerDevice(ana, ANA_DEVICE).expect(204);
      expo.failNext();

      const res = await paidCharge();
      expect(res.body.result).toBe('paid');
      expect(await notifiedAt()).toBeNull();

      await app.get(SweeperService).sweep();
      expect(expo.sent.map((m) => m.to)).toEqual([ANA_DEVICE]);
      expect(await notifiedAt()).not.toBeNull();
    });

    it('borra los tokens que Expo reporta como no registrados (app desinstalada)', async () => {
      await registerDevice(ana, ANA_DEVICE).expect(204);
      expo.unregistered.add(ANA_DEVICE);
      await paidCharge();

      expo.reset();
      await http
        .post('/charges')
        .set('Authorization', `Bearer ${ana}`)
        .send({ phone: '5598765432', amount: 1 })
        .expect(201);
      pey.pay('TX2');
      await deliver({
        type: 'codi.pn.payment_received',
        transactionId: 'TX2',
      }).expect(200);
      expect(expo.sent).toHaveLength(0);
    });
  });
});
