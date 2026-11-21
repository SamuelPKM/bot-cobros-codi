import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersService } from '../src/modules/users/services/users.service';
import {
  createTestApp,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

describe('Seguridad: autenticación y roles (e2e)', () => {
  let app: INestApplication;
  let users: UsersService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    users = app.get(UsersService);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    // El negocio nace con su admin "dueno" (contraseña admin-12345).
    const business = await seedBusiness(app);
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
      maxAmountCents: 50_000,
    });
  });

  async function login(username: string, password: string): Promise<string> {
    const res = await http
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  describe('POST /auth/login', () => {
    it('entrega un Bearer token y el usuario sin su hash', async () => {
      const res = await http
        .post('/auth/login')
        .send({ username: 'ANA', password: 'ana-12345' })
        .expect(200);
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(res.body.user).toEqual({
        id: expect.any(Number),
        businessId: expect.any(Number),
        username: 'ana',
        name: 'Ana',
        role: 'seller',
        active: true,
        maxAmount: 500,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password|scrypt/i);
    });

    it('responde 401 con el mismo mensaje para contraseña mala y usuario inexistente', async () => {
      const wrong = await http
        .post('/auth/login')
        .send({ username: 'ana', password: 'otra-cosa' })
        .expect(401);
      const missing = await http
        .post('/auth/login')
        .send({ username: 'nadie', password: 'otra-cosa' })
        .expect(401);
      expect(wrong.body.message).toBe(missing.body.message);
    });

    it('responde 403 a un vendedor desactivado', async () => {
      const ana = await users.findByUsername('ana');
      await users.update(ana!.id, { active: false });
      await http
        .post('/auth/login')
        .send({ username: 'ana', password: 'ana-12345' })
        .expect(403);
    });

    it('responde 400 si faltan datos o sobran campos', async () => {
      await http.post('/auth/login').send({}).expect(400);
      await http
        .post('/auth/login')
        .send({ username: 'ana', password: 'ana-12345', role: 'admin' })
        .expect(400);
    });

    it('limita los intentos por usuario: el sexto en un minuto recibe 429', async () => {
      for (let i = 0; i < 5; i++)
        await http
          .post('/auth/login')
          .send({ username: 'ana', password: `mala-${i}-xx` })
          .expect(401);
      await http
        .post('/auth/login')
        .send({ username: 'ana', password: 'ana-12345' })
        .expect(429);
      // Otro usuario desde la misma IP no queda bloqueado.
      await http
        .post('/auth/login')
        .send({ username: 'dueno', password: 'admin-12345' })
        .expect(200);
    });
  });

  describe('Bearer token en las rutas protegidas', () => {
    it('/health sigue siendo pública', async () => {
      await http.get('/health').expect(200);
    });

    it('GET /me responde 401 sin token, con token mal formado o firmado con otro secreto', async () => {
      await http.get('/me').expect(401);
      await http.get('/me').set('Authorization', 'Bearer basura').expect(401);
      const forged =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiJ9.Zm9yZ2VkLXNpZ25hdHVyZQ';
      await http
        .get('/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('GET /me devuelve al usuario del token', async () => {
      const token = await login('ana', 'ana-12345');
      const res = await http
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.user.username).toBe('ana');
    });

    it('un token deja de servir en cuanto el admin desactiva al vendedor', async () => {
      const token = await login('ana', 'ana-12345');
      const ana = await users.findByUsername('ana');
      await users.update(ana!.id, { active: false });
      await http.get('/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  describe('administración de vendedores (solo admin)', () => {
    it('el admin da de alta un vendedor y este puede entrar', async () => {
      const token = await login('dueno', 'admin-12345');
      const res = await http
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'leo',
          name: 'Leo',
          password: 'leo-12345',
          maxAmount: 300,
        })
        .expect(201);
      expect(res.body.user).toMatchObject({
        username: 'leo',
        role: 'seller',
        maxAmount: 300,
      });
      await login('leo', 'leo-12345');
    });

    it.each([
      { username: 'a', name: 'X', password: 'leo-12345' },
      { username: 'leo', name: 'Leo', password: 'corta' },
      { username: 'leo', name: '', password: 'leo-12345' },
      { username: 'leo', name: 'Leo', password: 'leo-12345', maxAmount: -1 },
      { username: 'leo', name: 'Leo', password: 'leo-12345', maxAmount: 1.234 },
      { username: 'leo', name: 'Leo', password: 'leo-12345', role: 'admin' },
    ])('responde 400 a %j', async (body) => {
      const token = await login('dueno', 'admin-12345');
      await http
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
    });

    it('responde 409 si el usuario ya existe (sin importar mayúsculas)', async () => {
      const token = await login('dueno', 'admin-12345');
      await http
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'ANA', name: 'Otra', password: 'ana-12345' })
        .expect(409);
    });

    it('lista vendedores y los desactiva o cambia su tope', async () => {
      const token = await login('dueno', 'admin-12345');
      const list = await http
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        list.body.users.map((u: { username: string }) => u.username),
      ).toEqual(['ana']);
      const id = list.body.users[0].id as number;
      const res = await http
        .patch(`/users/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false, maxAmount: 100 })
        .expect(200);
      expect(res.body.user).toMatchObject({ active: false, maxAmount: 100 });
    });

    it('responde 404 al editar un usuario inexistente o un admin', async () => {
      const token = await login('dueno', 'admin-12345');
      const admin = await users.findByUsername('dueno');
      await http
        .patch('/users/99999')
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false })
        .expect(404);
      await http
        .patch(`/users/${admin!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false })
        .expect(404);
    });

    it('un vendedor recibe 403 en todas las rutas de administración', async () => {
      const token = await login('ana', 'ana-12345');
      const ana = await users.findByUsername('ana');
      await http
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await http
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'x1x', name: 'X', password: 'x-1234567' })
        .expect(403);
      await http
        .patch(`/users/${ana!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxAmount: 999999 })
        .expect(403);
    });
  });

  describe('endurecimiento', () => {
    it('responde con headers de seguridad y sin X-Powered-By', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
