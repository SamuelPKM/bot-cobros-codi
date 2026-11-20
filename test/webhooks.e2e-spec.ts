import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';
import { DataSource } from 'typeorm';
import type { PublicCharge } from '../src/modules/charges/interfaces/public-charge.interface';
import { PeyError } from '../src/modules/pey/errors/pey.error';
import { UsersService } from '../src/modules/users/services/users.service';
import { FakePeyClient } from './fakes/fake-pey-client';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
} from './utils/test-app';

const SECRET = process.env.PEY_WEBHOOK_SECRET!;

describe('Webhook de pey: pagos (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let http: ReturnType<typeof request>;
  let ana: string;
  let messageCounter = 0;

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
    await app.get(UsersService).create({
      username: 'ana',
      name: 'Ana',
      role: 'seller',
      password: 'ana-12345',
    });
    ana = await loginAs(app, 'ana', 'ana-12345');
  });

  /** Manda un webhook firmado como lo hace pey. */
  function deliver(
    payload: object,
    { id = `msg_${++messageCounter}`, secret = SECRET } = {},
  ) {
    const body = JSON.stringify(payload);
    const at = new Date();
    return http
      .post('/webhooks/pey')
      .set('content-type', 'application/json')
      .set('webhook-id', id)
      .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
      .set('webhook-signature', new Webhook(secret).sign(id, at, body))
      .send(body);
  }

  const pushPaid = (transactionId: string, amount = 150) => ({
    type: 'codi.pn.payment_received',
    transactionId,
    amount,
    datePaid: 1790724758,
    metadata: { trackingKey: 'RASTREO1' },
    numRef: '1',
  });

  const qrPaid = (codiQrId: string, transactionId: string, amount = 150) => ({
    type: 'codi.qr.payment_received',
    codiQrId,
    transactionId,
    amount,
    datePaid: 1790725000,
    metadata: {},
    numRef: '1',
  });

  async function newCharge(amount = 150) {
    await http
      .post('/charges')
      .set('Authorization', `Bearer ${ana}`)
      .send({ phone: '5512345678', amount })
      .expect(201);
  }

  async function getCharge(id = 1): Promise<PublicCharge> {
    const res = await http
      .get(`/charges/${id}`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(200);
    return (res.body as { charge: PublicCharge }).charge;
  }

  describe('firma', () => {
    it('rechaza con 401 una firma inválida o un cuerpo alterado, sin tocar el cobro', async () => {
      await newCharge();
      pey.pay('TX1');
      await deliver(pushPaid('TX1'), {
        secret: 'whsec_b3Ryb3NlY3JldG9kaXN0aW50bw==',
      }).expect(401);
      await http.post('/webhooks/pey').send(pushPaid('TX1')).expect(401);
      expect((await getCharge()).status).toBe('pending');
    });

    it('es pública: no exige Bearer token (la autentica la firma)', async () => {
      await deliver({ type: 'bank_account.updated' }).expect(200);
    });
  });

  describe('pago de un push', () => {
    it('marca el cobro como pagado por push, después de confirmarlo con la API', async () => {
      await newCharge();
      pey.pay('TX1', { trackingKey: 'RASTREO-ABC' });

      const res = await deliver(pushPaid('TX1')).expect(200);
      expect(res.body).toEqual({ ok: true, result: 'paid' });

      const charge = await getCharge();
      expect(charge).toMatchObject({
        status: 'paid',
        paidVia: 'push',
        paidAt: new Date(1790724758 * 1000).toISOString(),
      });
      expect(charge.attempts[0]).toMatchObject({
        kind: 'push',
        status: 'paid',
      });
    });

    it('la API es la fuente de verdad: si dice que no está pagado responde 500 para que pey reintente', async () => {
      await newCharge();
      const first = await deliver(pushPaid('TX1'), { id: 'msg_retry' }).expect(
        500,
      );
      expect(first.body).toEqual({ ok: false });
      expect((await getCharge()).status).toBe('pending');

      pey.pay('TX1');
      await deliver(pushPaid('TX1'), { id: 'msg_retry' }).expect(200);
      expect((await getCharge()).status).toBe('paid');
    });

    it('si pey no responde al confirmar, responde 500 y no marca nada', async () => {
      await newCharge();
      pey.pay('TX1');
      pey.failNext(new PeyError('down', { type: 'NETWORK_ERROR' }));
      await deliver(pushPaid('TX1')).expect(500);
      expect((await getCharge()).status).toBe('pending');
    });

    it('un webhook-id repetido no se procesa dos veces', async () => {
      await newCharge();
      pey.pay('TX1');
      await deliver(pushPaid('TX1'), { id: 'msg_dup' }).expect(200);
      const second = await deliver(pushPaid('TX1'), { id: 'msg_dup' }).expect(
        200,
      );
      expect(second.body).toEqual({ ok: true, result: 'duplicate' });
    });

    it('el mismo pago avisado con otro webhook-id es idempotente', async () => {
      await newCharge();
      pey.pay('TX1');
      await deliver(pushPaid('TX1')).expect(200);
      const again = await deliver(pushPaid('TX1')).expect(200);
      expect(again.body.result).toBe('already_paid');
    });

    it('liga el pago por metadata.chargeId cuando el push quedó en duda (timeout)', async () => {
      pey.failNext(new PeyError('timeout', { type: 'TIMEOUT' }));
      await newCharge(80);
      expect((await getCharge()).attempts[0].status).toBe('unknown');

      pey.transactions.set('TX-PERDIDO', {
        id: 'TX-PERDIDO',
        status: 'PAID',
        amount: 80,
        amountBreakdown: { base: 80 },
        datePaid: 1790724758,
        metadata: { trackingKey: 'R', externalMetadata: { chargeId: '1' } },
      });
      const res = await deliver(pushPaid('TX-PERDIDO', 80)).expect(200);
      expect(res.body.result).toBe('paid');
      const charge = await getCharge();
      expect(charge.status).toBe('paid');
      expect(charge.attempts[0].status).toBe('paid');
    });

    it('no marca pagado si el monto no coincide', async () => {
      await newCharge(150);
      pey.pay('TX1');
      pey.transactions.get('TX1')!.amountBreakdown = { base: 1 };
      const res = await deliver(pushPaid('TX1', 1)).expect(200);
      expect(res.body.result).toBe('amount_mismatch');
      expect((await getCharge()).status).toBe('pending');
    });

    it('registra el pago aunque el cobro ya hubiera expirado (el dinero sí llegó)', async () => {
      await newCharge();
      await app.get(DataSource).query(`UPDATE charges SET status = 'expired'`);
      pey.pay('TX1');
      await deliver(pushPaid('TX1')).expect(200);
      expect((await getCharge()).status).toBe('paid');
    });

    it('ignora eventos de otro tipo y pagos de cobros que no conoce', async () => {
      expect(
        (await deliver({ type: 'bank_account.updated' }).expect(200)).body
          .result,
      ).toBe('ignored');
      pey.transactions.set('TX-AJENO', {
        id: 'TX-AJENO',
        status: 'PAID',
        amount: 5,
      });
      expect(
        (await deliver(pushPaid('TX-AJENO', 5)).expect(200)).body.result,
      ).toBe('unknown_charge');
      expect(
        (await deliver({ type: 'codi.pn.payment_received' }).expect(200)).body
          .result,
      ).toBe('missing_transaction_id');
    });
  });

  describe('pago de un QR', () => {
    it('liga el pago por el id del QR y lo marca pagado por QR', async () => {
      await newCharge();
      await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      const transactionId = pey.payQr('IDC1');

      const res = await deliver(qrPaid('IDC1', transactionId)).expect(200);
      expect(res.body.result).toBe('paid');
      const charge = await getCharge();
      expect(charge).toMatchObject({ status: 'paid', paidVia: 'qr' });
      expect(charge.attempts.map((a: { status: string }) => a.status)).toEqual([
        'pending',
        'paid',
      ]);
    });

    it('si pagan el push y también el QR, el segundo queda como pago de más para devolverlo', async () => {
      await newCharge();
      await http
        .post('/charges/1/qr')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      pey.pay('TX1');
      await deliver(pushPaid('TX1')).expect(200);

      const qrTx = pey.payQr('IDC1');
      const res = await deliver(qrPaid('IDC1', qrTx)).expect(200);
      expect(res.body.result).toBe('extra_payment');

      const charge = await getCharge();
      expect(charge).toMatchObject({ status: 'paid', paidVia: 'push' });
      expect(charge.attempts.map((a: { status: string }) => a.status)).toEqual([
        'paid',
        'paid',
      ]);
    });
  });
});
