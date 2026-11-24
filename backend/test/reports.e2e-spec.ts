import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

/** Fecha de hoy en la Ciudad de México (YYYY-MM-DD). */
const todayInMexico = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
    new Date(),
  );

describe('Reportes: resumen del día y CSV (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let admin: string;
  let ana: string;
  let leo: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    http = request(app.getHttpServer());
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    const business = await seedBusiness(app);
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
    });
    await seedUser(app, business.id, {
      username: 'leo',
      name: 'Leo',
      password: 'leo-12345',
    });
    admin = await loginAs(app, 'dueno', 'admin-12345');
    ana = await loginAs(app, 'ana', 'ana-12345');
    leo = await loginAs(app, 'leo', 'leo-12345');
  });

  const qrCharge = (token: string, amount: number, concept?: string) =>
    http
      .post('/charges')
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'qr', amount, concept })
      .expect(201);
  const setStatus = (id: number, status: string) =>
    db.query(`UPDATE charges SET status = $1 WHERE id = $2`, [status, id]);

  async function seedDay() {
    await qrCharge(ana, 100); // 1 pagado
    await qrCharge(ana, 50); // 2 pendiente
    await qrCharge(leo, 30); // 3 pagado
    await qrCharge(leo, 20); // 4 vencido
    await qrCharge(ana, 999); // 5 de ayer: no cuenta
    await setStatus(1, 'paid');
    await setStatus(3, 'paid');
    await setStatus(4, 'expired');
    await db.query(
      `UPDATE charges SET created_at = now() - interval '1 day' WHERE id = 5`,
    );
  }

  describe('GET /reports/today', () => {
    it('el admin ve los totales del negocio y el desglose por persona', async () => {
      await seedDay();
      const res = await http
        .get('/reports/today')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body).toEqual({
        date: todayInMexico(),
        paid: { count: 2, amount: 130 },
        pending: { count: 1, amount: 50 },
        expired: { count: 1 },
        byPerson: [
          {
            userId: expect.any(Number),
            name: 'Ana',
            role: 'seller',
            paidCount: 1,
            paidAmount: 100,
            pendingCount: 1,
          },
          {
            userId: expect.any(Number),
            name: 'Leo',
            role: 'seller',
            paidCount: 1,
            paidAmount: 30,
            pendingCount: 0,
          },
          {
            userId: expect.any(Number),
            name: 'Dueño',
            role: 'admin',
            paidCount: 0,
            paidAmount: 0,
            pendingCount: 0,
          },
        ],
      });
    });

    it('el vendedor solo ve lo suyo, sin desglose', async () => {
      await seedDay();
      const res = await http
        .get('/reports/today')
        .set('Authorization', `Bearer ${ana}`)
        .expect(200);
      expect(res.body).toMatchObject({
        paid: { count: 1, amount: 100 },
        pending: { count: 1, amount: 50 },
        expired: { count: 0 },
        byPerson: null,
      });
    });

    it('no cuenta nada de otro negocio', async () => {
      await seedDay();
      await seedBusiness(app, { adminUsername: 'otro', name: 'Otro' });
      const otro = await loginAs(app, 'otro', 'admin-12345');
      const res = await http
        .get('/reports/today')
        .set('Authorization', `Bearer ${otro}`)
        .expect(200);
      expect(res.body.paid).toEqual({ count: 0, amount: 0 });
    });

    it('exige sesión', async () => {
      await http.get('/reports/today').expect(401);
    });
  });

  describe('GET /reports/overview', () => {
    /** El día de hoy más un cobro pagado hace 8 días (periodo anterior) por QR. */
    async function seedWeek() {
      await seedDay();
      await qrCharge(ana, 50); // 6: pagado hace 8 días
      await setStatus(6, 'paid');
      await db.query(
        `UPDATE charges SET created_at = now() - interval '8 days' WHERE id = 6`,
      );
      await db.query(
        `UPDATE charges SET paid_via = 'qr' WHERE status = 'paid'`,
      );
    }

    it('el admin ve el periodo del negocio contra el anterior', async () => {
      await seedWeek();
      const res = await http
        .get('/reports/overview')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      const body = res.body;
      expect(body).toMatchObject({
        businessName: 'Tacos Ana',
        days: 7,
        to: todayInMexico(),
        paid: { count: 2, amount: 130 },
        previousPaidAmount: 50,
        paidChange: 1.6,
        averageTicket: 65,
        // 2 pagados de 3 terminados; los pendientes (2 y 5) no cuentan.
        paymentRate: 2 / 3,
        byMethod: [
          { method: 'push', count: 0, amount: 0 },
          { method: 'qr', count: 2, amount: 130 },
          { method: 'link', count: 0, amount: 0 },
        ],
      });
      expect(body.daily).toHaveLength(7);
      expect(body.daily.at(-1)).toEqual({
        date: todayInMexico(),
        count: 2,
        amount: 130,
      });
      expect(body.daily[0].date).toBe(body.from);
      expect(body.peakHour).toEqual(expect.any(Number));
    });

    it('el vendedor solo ve lo suyo', async () => {
      await seedWeek();
      const res = await http
        .get('/reports/overview?days=30')
        .set('Authorization', `Bearer ${ana}`)
        .expect(200);
      expect(res.body).toMatchObject({
        businessName: 'Tacos Ana',
        days: 30,
        // 1 de hoy y el de hace 8 días: ya entra en 30 días.
        paid: { count: 2, amount: 150 },
        previousPaidAmount: 0,
        paidChange: null,
      });
      expect(res.body.daily).toHaveLength(30);
    });

    it('sin cobros, todo en cero y sin tasas', async () => {
      const res = await http
        .get('/reports/overview')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body).toMatchObject({
        paid: { count: 0, amount: 0 },
        averageTicket: null,
        paymentRate: null,
        paidChange: null,
        peakHour: null,
      });
    });

    it('solo acepta 7, 30 o 90 días', async () => {
      await http
        .get('/reports/overview?days=5')
        .set('Authorization', `Bearer ${admin}`)
        .expect(400);
    });

    it('exige sesión', async () => {
      await http.get('/reports/overview').expect(401);
    });
  });

  describe('GET /reports/charges.csv', () => {
    it('el admin descarga los cobros del día de su negocio', async () => {
      await seedDay();
      const res = await http
        .get('/reports/charges.csv')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="cobros-${todayInMexico()}_${todayInMexico()}.csv"`,
      );
      const lines = res.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\r\n');
      expect(lines[0]).toBe(
        'id,fecha,vendedor,celular,monto,concepto,estado,pagado_por,pagado_el',
      );
      expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
      expect(lines[1]).toMatch(
        /^1,\d{4}-\d{2}-\d{2} \d{2}:\d{2},Ana,,100\.00,,paid,,/,
      );
    });

    it('el vendedor solo descarga los suyos', async () => {
      await seedDay();
      const res = await http
        .get('/reports/charges.csv')
        .set('Authorization', `Bearer ${leo}`)
        .expect(200);
      const ids = res.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\r\n')
        .slice(1)
        .map((l) => l.split(',')[0]);
      expect(ids).toEqual(['3', '4']);
    });

    it('filtra por rango de fechas (incluye ambos extremos)', async () => {
      await seedDay();
      const res = await http
        .get('/reports/charges.csv?from=2020-01-01&to=2020-01-31')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(
        res.text
          .replace(/^\uFEFF/, '')
          .trim()
          .split('\r\n'),
      ).toHaveLength(1);
    });

    it.each([
      'from=2026-13-01',
      'from=ayer',
      'from=2026-02-10&to=2026-02-01',
      'from=2026-01-01&to=2026-06-01',
    ])('responde 400 a ?%s', async (query) => {
      await http
        .get(`/reports/charges.csv?${query}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(400);
    });

    it('neutraliza un concepto con fórmula para que Excel no la ejecute', async () => {
      await qrCharge(ana, 10, '=HYPERLINK("http://x")');
      const res = await http
        .get('/reports/charges.csv')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`);
    });
  });
});
