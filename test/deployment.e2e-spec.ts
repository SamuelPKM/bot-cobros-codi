import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

// setup-env.ts activa TRUST_PROXY y permite el origen http://localhost:8081.
const ALLOWED = 'http://localhost:8081';

describe('Listo para producción detrás de un proxy (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

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
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
    });
  });

  describe('CORS (demo de Expo en el navegador)', () => {
    it('permite el origen configurado, con el header Authorization', async () => {
      const res = await http
        .options('/charges')
        .set('Origin', ALLOWED)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(res.headers['access-control-allow-headers']).toMatch(
        /authorization/i,
      );
    });

    it('no permite otros orígenes', async () => {
      const res = await http
        .get('/health')
        .set('Origin', 'https://evil.example')
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('trust proxy', () => {
    const failLogin = (ip: string) =>
      http
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: 'ana', password: 'mala-clave' });

    it('cuenta los intentos de login por la IP real del cliente, no por la del proxy', async () => {
      for (let i = 0; i < 5; i++) await failLogin('203.0.113.10').expect(401);
      await failLogin('203.0.113.10').expect(429);
      // Otro cliente detrás del mismo proxy no queda bloqueado.
      await failLogin('198.51.100.7').expect(401);
    });
  });
});
