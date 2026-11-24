import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeLogoStorage } from './fakes/fake-logo-storage';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

/** Un PNG mínimo: los 8 bytes de firma y algo de relleno. */
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);
const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(32, 2),
]);

describe('Logo del negocio (e2e)', () => {
  let app: INestApplication;
  let logos: FakeLogoStorage;
  let http: ReturnType<typeof request>;
  let admin: string;
  let seller: string;

  beforeAll(async () => {
    ({ app, logos } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    logos.reset();
    const business = await seedBusiness(app);
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
    });
    admin = await loginAs(app, 'dueno', 'admin-12345');
    seller = await loginAs(app, 'ana', 'ana-12345');
  });

  const upload = (token: string, file: Buffer, filename = 'logo.png') =>
    http
      .post('/businesses/me/logo')
      .set('Authorization', `Bearer ${token}`)
      .attach('logo', file, filename);

  it('el admin sube un logo y todo el equipo lo ve', async () => {
    const res = await upload(admin, png).expect(200);
    expect(res.body.logoVersion).toMatch(/^[a-f0-9]{16}$/);

    const me = await http
      .get('/businesses/me')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(me.body.business).toMatchObject({
      logoVersion: res.body.logoVersion,
      logosEnabled: true,
    });

    const image = await http
      .get('/businesses/me/logo')
      .set('Authorization', `Bearer ${seller}`)
      .buffer(true)
      .expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(image.body as Buffer, png)).toBe(0);

    const overview = await http
      .get('/reports/overview')
      .set('Authorization', `Bearer ${seller}`)
      .expect(200);
    expect(overview.body.logoVersion).toBe(res.body.logoVersion);
  });

  it('al cambiarlo, la versión cambia y el anterior se borra del bucket', async () => {
    const first = (await upload(admin, png).expect(200)).body.logoVersion;
    const second = (await upload(admin, jpeg, 'logo.jpg').expect(200)).body
      .logoVersion;
    expect(second).not.toBe(first);
    expect([...logos.objects.keys()]).toEqual([
      expect.stringMatching(new RegExp(`^logos/\\d+/${second}\\.jpg$`)),
    ]);
  });

  it('juzga por el contenido: rechaza SVG aunque diga .png, y archivos vacíos', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const res = await upload(admin, svg, 'logo.png').expect(400);
    expect(res.body.message).toBe(
      'El logo debe ser una imagen PNG, JPG o WebP',
    );
    await http
      .post('/businesses/me/logo')
      .set('Authorization', `Bearer ${admin}`)
      .expect(400);
    expect(logos.objects.size).toBe(0);
  });

  it('rechaza logos de más de 1 MB', async () => {
    const big = Buffer.concat([png, Buffer.alloc(1024 * 1024)]);
    const res = await upload(admin, big).expect(413);
    expect(res.body.message).toBe('El logo debe pesar máximo 1 MB');
  });

  it('un vendedor no puede cambiar ni quitar el logo', async () => {
    await upload(seller, png).expect(403);
    await http
      .delete('/businesses/me/logo')
      .set('Authorization', `Bearer ${seller}`)
      .expect(403);
  });

  it('el admin lo quita; después es 404', async () => {
    await upload(admin, png).expect(200);
    await http
      .delete('/businesses/me/logo')
      .set('Authorization', `Bearer ${admin}`)
      .expect(204);
    expect(logos.objects.size).toBe(0);
    await http
      .get('/businesses/me/logo')
      .set('Authorization', `Bearer ${admin}`)
      .expect(404);
  });

  it('cada negocio ve solo su logo', async () => {
    await upload(admin, png).expect(200);
    await seedBusiness(app, { adminUsername: 'otro', name: 'Otro' });
    const otro = await loginAs(app, 'otro', 'admin-12345');
    await http
      .get('/businesses/me/logo')
      .set('Authorization', `Bearer ${otro}`)
      .expect(404);
  });

  it('exige sesión', async () => {
    await http.get('/businesses/me/logo').expect(401);
  });
});
