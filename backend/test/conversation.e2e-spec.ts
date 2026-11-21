import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConversationService } from '../src/modules/conversations/services/conversation.service';
import { PeyError } from '../src/modules/pey/errors/pey.error';
import type { User } from '../src/modules/users/entities/user.entity';
import { FakePeyClient } from './fakes/fake-pey-client';
import { FakePeyClientFactory } from './fakes/fake-pey-client-factory';
import {
  createTestApp,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
} from './utils/test-app';

describe('Motor de conversación (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let peyFactory: FakePeyClientFactory;
  let chat: ConversationService;
  let ana: User;

  beforeAll(async () => {
    ({ app, pey, peyFactory } = await createTestApp());
    chat = app.get(ConversationService);
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
    ana = await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
      maxAmountCents: 100_000,
    });
    peyFactory.calls.length = 0;
  });

  const say = async (text: string) => chat.handle(ana, text);
  const text = async (message: string) =>
    (await say(message)).map((r) => r.text).join('\n');

  it('ayuda y mensajes que no entiende', async () => {
    expect(await text('hola')).toMatch(/cobra 150 a 5512345678/);
    expect(await text('qué tal')).toMatch(/No entendí/);
    expect(await text('cobra 150 a 123')).toMatch(/10 dígitos/);
  });

  describe('cobro push con confirmación', () => {
    it('"cobra" pide confirmar y no cobra todavía', async () => {
      const reply = await text('cobra 150 a 5512345678 corte');
      expect(reply).toMatch(
        /Vas a cobrar \$150\.00 al 55 1234 5678 por "corte"/,
      );
      expect(reply).toMatch(/sí/);
      expect(pey.pushes).toHaveLength(0);
    });

    it('"sí" manda el push con la API key del negocio; un segundo "sí" ya no hace nada', async () => {
      await say('cobra 150 a 5512345678 corte');
      expect(await text('sí')).toMatch(/Listo, envié el cobro de \$150\.00/);
      expect(pey.pushes).toEqual([
        expect.objectContaining({
          amount: 150,
          phoneNumber: '5512345678',
          concept: 'Tacos Ana: corte',
        }),
      ]);
      expect(peyFactory.keysUsedFor('createPush')).toEqual([
        'pey_key_ana_aaaa',
      ]);

      expect(await text('sí')).toMatch(/No tienes ningún cobro por confirmar/);
      expect(pey.pushes).toHaveLength(1);
    });

    it('dos "sí" al mismo tiempo mandan un solo cobro', async () => {
      await say('cobra 150 a 5512345678');
      await Promise.all([say('sí'), say('sí')]);
      expect(pey.pushes).toHaveLength(1);
    });

    it('"no" cancela el borrador', async () => {
      await say('cobra 150 a 5512345678');
      expect(await text('no')).toMatch(/Cancelado/);
      expect(await text('sí')).toMatch(/No tienes ningún cobro por confirmar/);
      expect(pey.pushes).toHaveLength(0);
    });

    it('un borrador de más de 10 minutos ya no se manda', async () => {
      await say('cobra 150 a 5512345678');
      await app
        .get(DataSource)
        .query(
          `UPDATE charge_drafts SET created_at = now() - interval '11 minutes'`,
        );
      expect(await text('sí')).toMatch(/caducó/);
      expect(pey.pushes).toHaveLength(0);
    });

    it('un cobro nuevo reemplaza al borrador anterior', async () => {
      await say('cobra 150 a 5512345678');
      await say('cobra 90 a 5598765432');
      await say('sí');
      expect(pey.pushes.map((p) => p.amount)).toEqual([90]);
    });

    it('respeta el tope de la persona', async () => {
      await say('cobra 2000 a 5512345678');
      expect(await text('sí')).toMatch(
        /monto máximo por cobro es de \$1000\.00/,
      );
      expect(pey.pushes).toHaveLength(0);
    });

    it('si pey lo rechaza explica por qué y sugiere la liga', async () => {
      pey.failNext(
        new PeyError('inactive', { type: 'INVALID_STATE', status: 400 }),
      );
      await say('cobra 150 a 5512345678 corte');
      const reply = await text('sí');
      expect(reply).toMatch(/No se pudo enviar el cobro/);
      expect(reply).toMatch(/no está activa/);
      expect(reply).toMatch(/liga/);
    });

    it('si pey no contesta, pide no repetirlo', async () => {
      pey.failNext(new PeyError('timeout', { type: 'TIMEOUT' }));
      await say('cobra 150 a 5512345678');
      expect(await text('sí')).toMatch(
        /No pude confirmar si el cobro .* se envió/,
      );
    });
  });

  describe('QR, liga y resumen', () => {
    it('"qr" devuelve el contenido del QR para que el canal lo dibuje', async () => {
      const [reply] = await say('qr 80 café');
      expect(reply.text).toMatch(/QR para cobrar \$80\.00 por "café"/);
      expect(reply.qrString).toEqual(expect.stringContaining('IDC1'));
    });

    it('"liga 50" devuelve la liga para reenviarla', async () => {
      const [reply] = await say('liga 50 pastel');
      expect(reply.text).toContain('https://app.mipey.mx/payment-link/LINK1');
      expect(reply.url).toBe('https://app.mipey.mx/payment-link/LINK1');
    });

    it('"liga" sola genera la liga del último cobro pendiente (plan B del push)', async () => {
      expect(await text('liga')).toMatch(/No tienes ningún cobro pendiente/);
      await say('cobra 150 a 5512345678');
      await say('sí');
      const [reply] = await say('liga');
      expect(reply.url).toBe('https://app.mipey.mx/payment-link/LINK1');
      expect(pey.links).toEqual([
        expect.objectContaining({ amount: 150, clientReferenceId: 'cobro-1' }),
      ]);
    });

    it('"resumen" da el corte de hoy', async () => {
      await say('qr 80');
      await app.get(DataSource).query(`UPDATE charges SET status = 'paid'`);
      await say('qr 20');
      const reply = await text('resumen');
      expect(reply).toMatch(/Cobrado hoy: \$80\.00 en 1 cobro/);
      expect(reply).toMatch(/Pendientes: 1 por \$20\.00/);
    });
  });
});
