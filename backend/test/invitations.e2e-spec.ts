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

describe('Invitaciones con liga de un solo uso (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: DataSource;
  let admin: string;
  let seller: string;

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
    const business = await seedBusiness(app, { name: 'Tacos Ana' });
    await seedUser(app, business.id, {
      username: 'leo',
      password: 'leo-12345',
    });
    admin = await loginAs(app, 'dueno', 'admin-12345');
    seller = await loginAs(app, 'leo', 'leo-12345');
  });

  async function invite(body: object = {}) {
    const res = await http
      .post('/invitations')
      .set('Authorization', `Bearer ${admin}`)
      .send(body)
      .expect(201);
    return res.body as {
      token: string;
      invitation: { id: number; role: string; expiresAt: string; url: string };
    };
  }

  const accept = (token: string, body: object = {}) =>
    http.post(`/invitations/token/${token}/accept`).send({
      name: 'Mara',
      username: 'mara',
      password: 'mara-12345',
      ...body,
    });

  describe('el admin invita', () => {
    it('genera una liga de 7 días hacia la pantalla del frontend', async () => {
      const { token, invitation } = await invite();
      expect(token).toMatch(/^[\w-]{40,}$/);
      expect(invitation).toMatchObject({
        role: 'seller',
        url: `https://cobrale.test/invitacion/${token}`,
      });
      const days = (Date.parse(invitation.expiresAt) - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThanOrEqual(7);
    });

    it('guarda solo el hash del token', async () => {
      const { token } = await invite();
      const rows = await db.query<Record<string, unknown>[]>(
        `SELECT * FROM invitations`,
      );
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('lista las invitaciones vigentes sin el token y puede revocarlas', async () => {
      const { token, invitation } = await invite({ role: 'admin' });
      const list = await http
        .get('/invitations')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(list.body.invitations).toEqual([
        {
          id: invitation.id,
          role: 'admin',
          expiresAt: invitation.expiresAt,
          createdAt: expect.any(String),
        },
      ]);

      await http
        .delete(`/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(204);
      expect(
        (await http.get('/invitations').set('Authorization', `Bearer ${admin}`))
          .body.invitations,
      ).toEqual([]);
      await accept(token).expect(410);
    });

    it('un vendedor no invita, no lista ni revoca', async () => {
      const { invitation } = await invite();
      await http
        .post('/invitations')
        .set('Authorization', `Bearer ${seller}`)
        .send({})
        .expect(403);
      await http
        .get('/invitations')
        .set('Authorization', `Bearer ${seller}`)
        .expect(403);
      await http
        .delete(`/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${seller}`)
        .expect(403);
    });

    it('no revoca invitaciones de otro negocio', async () => {
      const { invitation } = await invite();
      await seedBusiness(app, { adminUsername: 'otro', name: 'Otro' });
      const otro = await loginAs(app, 'otro', 'admin-12345');
      await http
        .delete(`/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${otro}`)
        .expect(404);
    });

    it('valida el rol', async () => {
      await http
        .post('/invitations')
        .set('Authorization', `Bearer ${admin}`)
        .send({ role: 'root' })
        .expect(400);
    });
  });

  describe('la persona invitada', () => {
    it('ve a qué negocio la invitan sin iniciar sesión', async () => {
      const { token } = await invite();
      const res = await http.get(`/invitations/token/${token}`).expect(200);
      expect(res.body.invitation).toEqual({
        businessName: 'Tacos Ana',
        role: 'seller',
        expiresAt: expect.any(String),
      });
    });

    it('elige su usuario y contraseña, entra al negocio con el rol de la invitación y abre sesión', async () => {
      const { token } = await invite({ role: 'admin' });
      const res = await accept(token).expect(201);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        user: { username: 'mara', name: 'Mara', role: 'admin' },
      });

      const team = await http
        .get('/users')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(
        team.body.users.map((u: { username: string }) => u.username),
      ).toContain('mara');
    });

    it('la liga sirve una sola vez, aunque se use dos veces al mismo tiempo', async () => {
      const { token } = await invite();
      const [a, b] = await Promise.all([
        accept(token, { username: 'mara1' }),
        accept(token, { username: 'mara2' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 410]);
      await accept(token, { username: 'mara3' }).expect(410);
      await http.get(`/invitations/token/${token}`).expect(410);
    });

    it('una invitación vencida ya no sirve', async () => {
      const { token } = await invite();
      await db.query(
        `UPDATE invitations SET expires_at = now() - interval '1 minute'`,
      );
      await http.get(`/invitations/token/${token}`).expect(410);
      await accept(token).expect(410);
    });

    it('un token que no existe responde 404', async () => {
      await http.get('/invitations/token/no-existe').expect(404);
      await accept('no-existe').expect(404);
    });

    it('si el usuario ya existe responde 409 y la invitación sigue disponible', async () => {
      const { token } = await invite();
      await accept(token, { username: 'leo' }).expect(409);
      await accept(token).expect(201);
    });

    it('valida los datos de la cuenta', async () => {
      const { token } = await invite();
      await accept(token, { password: 'corta' }).expect(400);
      await accept(token, { role: 'admin' }).expect(400);
    });
  });
});
