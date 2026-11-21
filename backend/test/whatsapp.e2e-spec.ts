import { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';
import { DataSource } from 'typeorm';
import { UsersService } from '../src/modules/users/services/users.service';
import { FakePeyClient } from './fakes/fake-pey-client';
import { FakePeyClientFactory } from './fakes/fake-pey-client-factory';
import { FakeWhatsAppClient } from './fakes/fake-whatsapp-client';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  seedUser,
  TEST_WEBHOOK_SECRET,
} from './utils/test-app';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
/** Así entrega Meta un celular mexicano. */
const ANA_WA = '5215511112222';

describe('WhatsApp (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let peyFactory: FakePeyClientFactory;
  let whatsapp: FakeWhatsAppClient;
  let http: ReturnType<typeof request>;
  let ana: string;
  let peyWebhookPath: string;
  let counter = 0;

  beforeAll(async () => {
    ({ app, pey, peyFactory, whatsapp } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    peyFactory.reset();
    whatsapp.reset();
    const business = await seedBusiness(app, {
      name: 'Tacos Ana',
      apiKey: 'pey_key_ana_aaaa',
    });
    peyWebhookPath = `/webhooks/pey/${business.webhookSlug}`;
    await seedUser(app, business.id, {
      username: 'ana',
      name: 'Ana',
      password: 'ana-12345',
    });
    ana = await loginAs(app, 'ana', 'ana-12345');
  });

  /** Entrega un webhook firmado como lo hace Meta. */
  function deliver(messages: object[], { secret = APP_SECRET } = {}) {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: { messaging_product: 'whatsapp', messages },
            },
          ],
        },
      ],
    });
    return http
      .post('/webhooks/whatsapp')
      .set('content-type', 'application/json')
      .set(
        'x-hub-signature-256',
        `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      )
      .send(body);
  }

  const textMessage = (
    body: string,
    from = ANA_WA,
    id = `wamid.${++counter}`,
  ) => ({
    id,
    from,
    type: 'text',
    text: { body },
  });

  async function say(body: string, from = ANA_WA) {
    await deliver([textMessage(body, from)]).expect(200);
    return whatsapp.textsTo(from).at(-1) ?? '';
  }

  async function linkAna() {
    const res = await http
      .post('/me/whatsapp/link-code')
      .set('Authorization', `Bearer ${ana}`)
      .expect(201);
    expect(await say(`vincular ${res.body.code as string}`)).toMatch(
      /quedó ligado a \*Tacos Ana\*/,
    );
  }

  describe('webhook de Meta', () => {
    it('GET verifica la URL con el token de verificación', async () => {
      const ok = await http
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': '12345',
        })
        .expect(200);
      expect(ok.text).toBe('12345');
      await http
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'otro',
          'hub.challenge': '12345',
        })
        .expect(403);
    });

    it('POST rechaza una firma inválida y no responde nada', async () => {
      await deliver([textMessage('hola')], { secret: 'otro' }).expect(401);
      expect(whatsapp.sent).toHaveLength(0);
    });

    it('un mensaje repetido por Meta se atiende una sola vez', async () => {
      const message = textMessage('hola', ANA_WA, 'wamid.repetido');
      await deliver([message]).expect(200);
      await deliver([message]).expect(200);
      expect(whatsapp.textsTo(ANA_WA)).toHaveLength(1);
    });
  });

  describe('vincular el número', () => {
    it('un número sin cuenta recibe cómo registrarse en la web', async () => {
      expect(await say('hola')).toMatch(
        /no está ligado.*https:\/\/cobrale\.test/s,
      );
    });

    it('con el código de la cuenta el número queda ligado a esa persona', async () => {
      await linkAna();
      const me = await http
        .get('/me/whatsapp')
        .set('Authorization', `Bearer ${ana}`)
        .expect(200);
      expect(me.body).toEqual({ linked: true, phone: '55 1111 2222' });
    });

    it('un código equivocado o vencido no liga nada', async () => {
      expect(await say('vincular 000000')).toMatch(/no es válido o ya venció/);
      const res = await http
        .post('/me/whatsapp/link-code')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      await app
        .get(DataSource)
        .query(
          `UPDATE whatsapp_link_codes SET expires_at = now() - interval '1 minute'`,
        );
      expect(await say(`vincular ${res.body.code as string}`)).toMatch(
        /no es válido o ya venció/,
      );
    });

    it('tras 5 códigos equivocados el número se pausa, aunque luego mande el bueno', async () => {
      const guesser = '5215599990000';
      for (let i = 0; i < 5; i++) await say(`vincular 00000${i}`, guesser);
      const res = await http
        .post('/me/whatsapp/link-code')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      expect(await say(`vincular ${res.body.code as string}`, guesser)).toMatch(
        /Demasiados intentos/,
      );
      // El código no se gastó: Ana lo puede usar desde su número.
      expect(await say(`vincular ${res.body.code as string}`)).toMatch(
        /quedó ligado/,
      );
    });

    it('el código sirve una sola vez', async () => {
      const res = await http
        .post('/me/whatsapp/link-code')
        .set('Authorization', `Bearer ${ana}`)
        .expect(201);
      await say(`vincular ${res.body.code as string}`);
      expect(
        await say(`vincular ${res.body.code as string}`, '5215533334444'),
      ).toMatch(/no es válido/);
    });

    it('al desligarlo, el número ya no cobra', async () => {
      await linkAna();
      await http
        .delete('/me/whatsapp')
        .set('Authorization', `Bearer ${ana}`)
        .expect(204);
      expect(await say('resumen')).toMatch(/no está ligado/);
    });

    it('una persona desactivada ya no cobra por WhatsApp', async () => {
      await linkAna();
      const users = app.get(UsersService);
      await users.update((await users.findByUsername('ana'))!.id, {
        active: false,
      });
      expect(await say('qr 10')).toMatch(/no está ligado/);
      expect(pey.qrs).toHaveLength(0);
    });
  });

  describe('cobrar por WhatsApp', () => {
    beforeEach(async () => {
      await linkAna();
    });

    it('cobra con confirmación y la API key del negocio', async () => {
      expect(await say('cobra 150 a 5598765432 corte')).toMatch(
        /Vas a cobrar \$150\.00/,
      );
      expect(await say('sí')).toMatch(/Listo, envié el cobro/);
      expect(peyFactory.keysUsedFor('createPush')).toEqual([
        'pey_key_ana_aaaa',
      ]);
    });

    it('el QR llega como imagen con su pie de foto', async () => {
      await say('qr 80 café');
      const last = whatsapp.sent.at(-1)!;
      expect(last.png?.subarray(0, 4)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );
      expect(last.text).toMatch(/QR para cobrar \$80\.00/);
    });

    it('un mensaje que no es texto recibe la ayuda', async () => {
      await deliver([
        {
          id: `wamid.${++counter}`,
          from: ANA_WA,
          type: 'image',
          image: { id: 'x' },
        },
      ]).expect(200);
      expect(whatsapp.textsTo(ANA_WA).at(-1)).toMatch(
        /Solo entiendo mensajes de texto/,
      );
    });

    it('si responder falla, igual responde 200 a Meta (no reenvía el mensaje)', async () => {
      whatsapp.failNext();
      await deliver([textMessage('hola')]).expect(200);
    });

    it('cuando el cliente paga, el "✅ Pagado" le llega por WhatsApp a quien cobró', async () => {
      await say('cobra 150 a 5598765432 corte');
      await say('sí');
      pey.pay('TX1', { trackingKey: 'RASTREO-9' });

      const body = JSON.stringify({
        type: 'codi.pn.payment_received',
        transactionId: 'TX1',
      });
      const at = new Date();
      await http
        .post(peyWebhookPath)
        .set('content-type', 'application/json')
        .set('webhook-id', 'msg_pago')
        .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
        .set(
          'webhook-signature',
          new Webhook(TEST_WEBHOOK_SECRET).sign('msg_pago', at, body),
        )
        .send(body)
        .expect(200);

      expect(whatsapp.textsTo(ANA_WA).at(-1)).toMatch(
        /✅ Pagado: \$150\.00 al 55 9876 5432 por "corte"[\s\S]*RASTREO-9/,
      );
    });
  });
});
