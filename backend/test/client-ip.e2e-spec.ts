import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  resetDatabase,
  resetThrottling,
  seedBusiness,
} from './utils/test-app';

const SECRET = process.env.FRONT_PROXY_SECRET!;

/**
 * La web (Next) llama a la API desde su servidor: sin esto, todos los
 * visitantes tendrían la IP de Next y los límites por IP serían globales.
 * Se usa la demo (20 sesiones por hora por IP) para observarlo.
 */
describe('IP del visitante que manda la web (e2e)', () => {
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
    await seedBusiness(app, { name: 'Tacos Demo' });
  });

  /** Lo que hace el servidor de Next: misma IP de origen, distinto visitante. */
  const fromWeb = (clientIp: string, secret = SECRET) =>
    http
      .post('/demo/sessions')
      .set('X-Forwarded-For', '10.0.0.5')
      .set('X-Cobrale-Proxy', secret)
      .set('X-Cobrale-Client-Ip', clientIp);

  it('con el secreto, cada visitante cuenta por su propia IP', async () => {
    for (let i = 0; i < 20; i++) await fromWeb('198.51.100.1').expect(201);
    await fromWeb('198.51.100.1').expect(429);
    await fromWeb('198.51.100.2').expect(201);
  });

  it('sin el secreto correcto el header se ignora (no se puede falsear la IP)', async () => {
    for (let i = 0; i < 20; i++)
      await fromWeb(
        `198.51.100.${i + 10}`,
        'secreto-equivocado-de-32-caracteres!',
      ).expect(201);
    // Todas contaron como 10.0.0.5.
    await fromWeb(
      '198.51.100.99',
      'secreto-equivocado-de-32-caracteres!',
    ).expect(429);
  });

  it('una IP inválida se ignora', async () => {
    for (let i = 0; i < 20; i++) await fromWeb('no-es-ip').expect(201);
    await fromWeb('tampoco').expect(429);
  });
});
