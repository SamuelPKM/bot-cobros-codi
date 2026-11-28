import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';
import { DataSource } from 'typeorm';
import type { PublicCharge } from '../src/modules/charges/interfaces/public-charge.interface';
import { SweeperService } from '../src/modules/sweeper/services/sweeper.service';
import { FakePeyClient } from './fakes/fake-pey-client';
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

describe('Liga de pago y cobros sin teléfono (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let peyFactory: FakePeyClientFactory;
  let http: ReturnType<typeof request>;
  let ana: string;
  let webhookPath: string;
  let counter = 0;

  beforeAll(async () => {
    ({ app, pey, peyFactory } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    peyFactory.reset();
    const business = await seedBusiness(app, {
      name: 'Tacos Ana',
      apiKey: 'pey_key_ana_aaaa',
    });
    webhookPath = `/webhooks/pey/${business.webhookSlug}`;
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
    });
    ana = await loginAs(app, 'ana', 'ana-12345');
    peyFactory.calls.length = 0;
  });

  const charge = (body: object) =>
    http.post('/charges').set('Authorization', `Bearer ${ana}`).send(body);

  async function getCharge(id = 1): Promise<PublicCharge> {
    const res = await http
      .get(`/charges/${id}`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(200);
    return (res.body as { charge: PublicCharge }).charge;
  }

  function deliver(payload: object) {
    const id = `msg_${++counter}`;
    const body = JSON.stringify(payload);
    const at = new Date();
    return http
      .post(webhookPath)
      .set('content-type', 'application/json')
      .set('webhook-id', id)
      .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
      .set(
        'webhook-signature',
        new Webhook(TEST_WEBHOOK_SECRET).sign(id, at, body),
      )
      .send(body);
  }

  describe('POST /charges con method', () => {
    it('method "link": crea la liga con la API key del negocio y regreso a pantallas del frontend', async () => {
      const res = await charge({
        method: 'link',
        amount: 150,
        concept: 'Pastel',
      }).expect(201);

      expect(res.body.charge).toMatchObject({
        status: 'pending',
        amount: 150,
        payerPhone: null,
      });
      expect(res.body.charge.attempts[0]).toMatchObject({
        kind: 'link',
        status: 'pending',
        linkUrl: 'https://app.mipey.mx/payment-link/LINK1',
      });
      expect(res.body.link).toEqual({
        url: 'https://app.mipey.mx/payment-link/LINK1',
      });
      expect(pey.links).toEqual([
        {
          amount: 150,
          successUrl: 'https://cobrale.test/pago/gracias',
          backUrl: 'https://cobrale.test/pago/cancelado',
          clientReferenceId: 'cobro-1',
          metadata: { chargeId: '1' },
        },
      ]);
      expect(peyFactory.keysUsedFor('createPaymentLink')).toEqual([
        'pey_key_ana_aaaa',
      ]);
    });

    it('method "qr": cobra con QR sin pedir el celular', async () => {
      const res = await charge({ method: 'qr', amount: 80 }).expect(201);
      expect(res.body.charge.payerPhone).toBeNull();
      expect(res.body.qr).toEqual({
        qrString: expect.any(String),
        expiresAt: expect.any(String),
      });
      expect(pey.pushes).toHaveLength(0);
    });

    it('el push sigue exigiendo el celular', async () => {
      await charge({ amount: 10 }).expect(400);
      await charge({ method: 'push', amount: 10 }).expect(400);
      await charge({ method: 'fax', amount: 10 }).expect(400);
    });
  });

  describe('POST /charges/:id/link (plan B)', () => {
    it('da una liga del mismo cobro si el push no llegó; si ya hay una vigente devuelve la misma', async () => {
      await charge({ phone: '5512345678', amount: 90 }).expect(201);
      const first = await http
        .post('/charges/1/link')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      const second = await http
        .post('/charges/1/link')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      expect(second.body.link).toEqual(first.body.link);
      expect(pey.links).toHaveLength(1);
      expect(
        first.body.charge.attempts.map((a: { kind: string }) => a.kind),
      ).toEqual(['push', 'link']);
    });

    it('responde 409 si el cobro ya no está pendiente', async () => {
      await charge({ phone: '5512345678', amount: 90 }).expect(201);
      await app.get(DataSource).query(`UPDATE charges SET status = 'paid'`);
      await http
        .post('/charges/1/link')
        .set('Authorization', `Bearer ${ana}`)
        .expect(409);
    });
  });

  describe('pago de la liga', () => {
    it('el webhook marca el cobro pagado por liga; la propina no cuenta contra el monto', async () => {
      await charge({ method: 'link', amount: 150 }).expect(201);
      pey.payLink('LINK1', { tip: 20 });

      const res = await deliver({
        type: 'payment_link.status_updated',
        paymentLinkId: 'LINK1',
        status: 'paid',
      }).expect(200);
      expect(res.body.result).toBe('paid');
      expect(await getCharge()).toMatchObject({
        status: 'paid',
        paidVia: 'link',
      });
      expect(peyFactory.keysUsedFor('getPaymentLink')).toEqual([
        'pey_key_ana_aaaa',
      ]);
    });

    it('una liga con propina nuestra se paga cuando pey confirma el total', async () => {
      await charge({ method: 'link', amount: 100, tip: 15 }).expect(201);
      expect(pey.links[0].amount).toBe(115);
      pey.payLink('LINK1');
      const res = await deliver({
        type: 'payment_link.status_updated',
        paymentLinkId: 'LINK1',
        status: 'paid',
      }).expect(200);
      expect(res.body.result).toBe('paid');
      expect(await getCharge()).toMatchObject({
        status: 'paid',
        amount: 115,
        tip: 15,
      });
    });

    it('si pey todavía no la tiene pagada responde 500 para que reintente', async () => {
      await charge({ method: 'link', amount: 150 }).expect(201);
      await deliver({
        type: 'payment_link.status_updated',
        paymentLinkId: 'LINK1',
        status: 'paid',
      }).expect(500);
      expect((await getCharge()).status).toBe('pending');
    });

    it('ignora otros estados de la liga', async () => {
      await charge({ method: 'link', amount: 150 }).expect(201);
      const res = await deliver({
        type: 'payment_link.status_updated',
        paymentLinkId: 'LINK1',
        status: 'processing',
      }).expect(200);
      expect(res.body.result).toBe('ignored');
    });

    it('al vencer, el barrido pregunta a pey: pagada -> pagado; si no, vencida', async () => {
      await charge({ method: 'link', amount: 150 }).expect(201);
      await charge({ method: 'link', amount: 60 }).expect(201);
      pey.payLink('LINK1');
      await app
        .get(DataSource)
        .query(
          `UPDATE payment_attempts SET expires_at = now() - interval '1 minute'`,
        );

      await app.get(SweeperService).sweep();

      expect((await getCharge(1)).status).toBe('paid');
      expect((await getCharge(2)).attempts[0].status).toBe('expired');
    });
  });
});
