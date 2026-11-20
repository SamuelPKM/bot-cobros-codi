import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { PublicCharge } from '../src/modules/charges/interfaces/public-charge.interface';
import { PeyError } from '../src/modules/pey/errors/pey.error';
import { SweeperService } from '../src/modules/sweeper/services/sweeper.service';
import { UsersService } from '../src/modules/users/services/users.service';
import { FakeExpoPushClient } from './fakes/fake-expo-push-client';
import { FakePeyClient } from './fakes/fake-pey-client';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
} from './utils/test-app';

describe('Barrido: vencer, conciliar con pey y reintentar avisos (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let expo: FakeExpoPushClient;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let sweeper: SweeperService;
  let ana: string;

  beforeAll(async () => {
    ({ app, pey, expo } = await createTestApp());
    http = request(app.getHttpServer());
    db = app.get(DataSource);
    sweeper = app.get(SweeperService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    pey.reset();
    expo.reset();
    await app.get(UsersService).create({
      username: 'ana',
      name: 'Ana',
      role: 'seller',
      password: 'ana-12345',
    });
    ana = await loginAs(app, 'ana', 'ana-12345');
    await http
      .post('/push-tokens')
      .set('Authorization', `Bearer ${ana}`)
      .send({ token: 'ExponentPushToken[ana]' });
  });

  const newCharge = () =>
    http
      .post('/charges')
      .set('Authorization', `Bearer ${ana}`)
      .send({ phone: '5512345678', amount: 150 })
      .expect(201);
  const showQr = () =>
    http
      .post('/charges/1/qr')
      .set('Authorization', `Bearer ${ana}`)
      .expect(201);

  async function getCharge(): Promise<PublicCharge> {
    const res = await http
      .get('/charges/1')
      .set('Authorization', `Bearer ${ana}`)
      .expect(200);
    return (res.body as { charge: PublicCharge }).charge;
  }

  /** Simula que pasó el tiempo: el intento venció hace un minuto. */
  const expireAttempts = (kind?: 'push' | 'qr') =>
    db.query(
      `UPDATE payment_attempts SET expires_at = now() - interval '1 minute'
        WHERE ($1::attempt_kind IS NULL OR kind = $1::attempt_kind)`,
      [kind ?? null],
    );
  const ageCharge = (minutes: number) =>
    db.query(
      `UPDATE charges SET created_at = now() - make_interval(mins => $1)`,
      [minutes],
    );

  it('vence un push que nadie pagó; el cobro sigue pendiente para el QR', async () => {
    await newCharge();
    await expireAttempts();
    await sweeper.sweep();

    const charge = await getCharge();
    expect(charge.attempts[0].status).toBe('expired');
    expect(charge.status).toBe('pending');
    await showQr();
  });

  it('no vence un intento que todavía está vigente', async () => {
    await newCharge();
    await sweeper.sweep();
    expect((await getCharge()).attempts[0].status).toBe('pending');
  });

  it('antes de vencer un push pregunta a pey: si se pagó y el webhook se perdió, lo marca pagado y avisa', async () => {
    await newCharge();
    pey.pay('TX1');
    await expireAttempts();
    await sweeper.sweep();

    expect(await getCharge()).toMatchObject({
      status: 'paid',
      paidVia: 'push',
    });
    expect(expo.sent).toHaveLength(1);
  });

  it('antes de vencer un QR revisa sus pagos en pey', async () => {
    await newCharge();
    await showQr();
    pey.payQr('IDC1');
    await expireAttempts();
    await sweeper.sweep();
    expect(await getCharge()).toMatchObject({ status: 'paid', paidVia: 'qr' });
  });

  it('un push en duda sin transactionId vence; si luego llega el pago, el webhook lo liga', async () => {
    pey.failNext(new PeyError('timeout', { type: 'TIMEOUT' }));
    await newCharge();
    await expireAttempts();
    await sweeper.sweep();
    expect((await getCharge()).attempts[0].status).toBe('expired');
  });

  it('si pey falla al revisar, deja el intento igual para el siguiente barrido', async () => {
    await newCharge();
    await expireAttempts();
    pey.failNext(new PeyError('down', { type: 'NETWORK_ERROR' }));
    await sweeper.sweep();
    expect((await getCharge()).attempts[0].status).toBe('pending');

    await sweeper.sweep();
    expect((await getCharge()).attempts[0].status).toBe('expired');
  });

  it('vence el cobro después de 30 minutos sin ningún intento vigente', async () => {
    await newCharge();
    await expireAttempts();
    await ageCharge(31);
    await sweeper.sweep();
    expect((await getCharge()).status).toBe('expired');
  });

  it('no vence un cobro viejo que todavía tiene un QR vigente', async () => {
    await newCharge();
    await expireAttempts('push');
    await showQr();
    await ageCharge(31);
    await sweeper.sweep();
    expect((await getCharge()).status).toBe('pending');
  });

  it('dos barridos al mismo tiempo no procesan lo mismo dos veces', async () => {
    await newCharge();
    pey.pay('TX1');
    await expireAttempts();
    await Promise.all([sweeper.sweep(), sweeper.sweep()]);
    expect(expo.sent).toHaveLength(1);
  });
});
