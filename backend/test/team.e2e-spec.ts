import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

describe('Equipo: roles sin dejar el negocio sin admin (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  let adminId: number;
  let anaId: number;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    const business = await seedBusiness(app);
    anaId = (
      await seedUser(app, business.id, {
        username: 'ana',
        name: 'Ana',
        password: 'ana-12345',
      })
    ).id;
    admin = await loginAs(app, 'dueno', 'admin-12345');
    adminId = (await http.get('/me').set('Authorization', `Bearer ${admin}`))
      .body.user.id as number;
  });

  const patch = (token: string, id: number, body: object) =>
    http
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('GET /users lista a todo el equipo, admins y vendedores', async () => {
    const res = await http
      .get('/users')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(
      res.body.users.map((u: { username: string; role: string }) => [
        u.username,
        u.role,
      ]),
    ).toEqual([
      ['dueno', 'admin'],
      ['ana', 'seller'],
    ]);
  });

  it('el admin hace admin a una vendedora y ella ya puede administrar', async () => {
    const res = await patch(admin, anaId, { role: 'admin' }).expect(200);
    expect(res.body.user.role).toBe('admin');
    const ana = await loginAs(app, 'ana', 'ana-12345');
    await http.get('/users').set('Authorization', `Bearer ${ana}`).expect(200);
  });

  it('un admin puede dejar de serlo si queda otro admin activo', async () => {
    await patch(admin, anaId, { role: 'admin' }).expect(200);
    await patch(admin, adminId, { role: 'seller' }).expect(200);
  });

  it.each([{ role: 'seller' }, { active: false }])(
    'responde 409 si el cambio %j deja el negocio sin admin activo',
    async (body) => {
      const res = await patch(admin, adminId, body).expect(409);
      expect(res.body.message).toMatch(/al menos un administrador activo/);
      await http
        .get('/users')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    },
  );

  it('dos admins que se quitan el rol al mismo tiempo: solo uno lo logra', async () => {
    await patch(admin, anaId, { role: 'admin' }).expect(200);
    const ana = await loginAs(app, 'ana', 'ana-12345');

    const results = await Promise.all([
      patch(admin, anaId, { role: 'seller' }),
      patch(ana, adminId, { role: 'seller' }),
    ]);

    // Gana uno. El otro recibe 409 (el candado lo detuvo) o 403 (cuando su
    // petición llegó, ya no era admin). Lo que nunca pasa: que ganen los dos.
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s !== 200)[0]).toBeGreaterThanOrEqual(403);

    // Si ganó la primera (el dueño le quitó el rol a Ana), el admin que queda es el dueño.
    const winner = results[0].status === 200 ? admin : ana;
    const team = await http
      .get('/users')
      .set('Authorization', `Bearer ${winner}`)
      .expect(200);
    const activeAdmins = team.body.users.filter(
      (u: { role: string; active: boolean }) => u.role === 'admin' && u.active,
    );
    expect(activeAdmins).toHaveLength(1);
  });

  it('valida el rol', async () => {
    await patch(admin, anaId, { role: 'root' }).expect(400);
  });
});
