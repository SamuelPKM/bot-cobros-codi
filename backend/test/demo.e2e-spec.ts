import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Webhook } from 'standardwebhooks';
import { DataSource } from 'typeorm';
import { FakePeyClient } from './fakes/fake-pey-client';
import { FakePeyClientFactory } from './fakes/fake-pey-client-factory';
import {
  createTestApp,
  loginAs,
  resetDatabase,
  resetThrottling,
  seedBusiness,
  TEST_WEBHOOK_SECRET,
} from './utils/test-app';

interface DemoMessage {
  id: number;
  sender: 'visitor' | 'bot';
  text: string;
  qrString?: string;
  url?: string;
}

describe('Demo pública (e2e)', () => {
  let app: INestApplication;
  let pey: FakePeyClient;
  let peyFactory: FakePeyClientFactory;
  let http: ReturnType<typeof request>;
  let webhookPath: string;

  beforeAll(async () => {
    ({ app, pey, peyFactory } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    resetThrottling(app);
    await resetDatabase(app);
    peyFactory.reset();
    // DEMO_BUSINESS_ID=1 (test/setup-env.ts): el primer negocio creado.
    const demo = await seedBusiness(app, {
      name: 'Tacos Demo',
      apiKey: 'pey_key_demo_dddd',
    });
    webhookPath = `/webhooks/pey/${demo.webhookSlug}`;
  });

  async function newSession(ip = '203.0.113.10') {
    const res = await http
      .post('/demo/sessions')
      .set('X-Forwarded-For', ip)
      .expect(201);
    return res.body as { sessionId: string; messages: DemoMessage[] };
  }

  async function say(sessionId: string, text: string) {
    const res = await http
      .post('/demo/messages')
      .set('X-Demo-Session', sessionId)
      .send({ text })
      .expect(200);
    return (res.body as { messages: DemoMessage[] }).messages;
  }

  const botText = (messages: DemoMessage[]) =>
    messages
      .filter((m) => m.sender === 'bot')
      .map((m) => m.text)
      .join('\n');

  async function payWebhook(transactionId: string) {
    const body = JSON.stringify({
      type: 'codi.pn.payment_received',
      transactionId,
    });
    const at = new Date();
    await http
      .post(webhookPath)
      .set('content-type', 'application/json')
      .set('webhook-id', `msg_${transactionId}`)
      .set('webhook-timestamp', String(Math.floor(at.getTime() / 1000)))
      .set(
        'webhook-signature',
        new Webhook(TEST_WEBHOOK_SECRET).sign(`msg_${transactionId}`, at, body),
      )
      .send(body)
      .expect(200);
  }

  it('GET /demo dice qué negocio se usa y sus límites', async () => {
    const res = await http.get('/demo').expect(200);
    expect(res.body).toEqual({
      businessName: 'Tacos Demo',
      maxAmount: 1,
      chargesPerHour: 5,
    });
  });

  it('una sesión nueva empieza con la bienvenida', async () => {
    const { sessionId, messages } = await newSession();
    expect(sessionId).toMatch(/^[a-f0-9]{32}$/);
    expect(messages).toHaveLength(1);
    expect(messages[0].sender).toBe('bot');
    expect(messages[0].text).toMatch(/Tacos Demo[\s\S]*\$1\.00/);
  });

  it('cobro por push completo: confirmación, envío y "✅ Pagado" al consultar', async () => {
    const { sessionId } = await newSession();
    const prompt = await say(sessionId, 'cobra 1 a 5598765432 prueba');
    expect(prompt.map((m) => m.sender)).toEqual(['visitor', 'bot']);
    expect(prompt[0].text).toBe('cobra 1 a 5598765432 prueba');
    expect(botText(prompt)).toMatch(/Vas a cobrar \$1\.00/);
    expect(botText(await say(sessionId, 'sí'))).toMatch(
      /Listo, envié el cobro/,
    );
    expect(peyFactory.keysUsedFor('createPush')).toEqual(['pey_key_demo_dddd']);

    pey.pay('TX1', { trackingKey: 'RASTREO-DEMO' });
    await payWebhook('TX1');

    const all = await http
      .get('/demo/messages')
      .set('X-Demo-Session', sessionId)
      .expect(200);
    const messages = all.body.messages as DemoMessage[];
    const paid = messages.filter((m) => /✅ Pagado/.test(m.text));
    expect(paid).toHaveLength(1);
    expect(paid[0].text).toMatch(
      /\$1\.00 al 55 9876 5432 por "prueba"[\s\S]*RASTREO-DEMO/,
    );

    // Solo lo nuevo con ?after, y el aviso no se repite.
    const last = messages.at(-1)!.id;
    const again = await http
      .get('/demo/messages')
      .query({ after: last })
      .set('X-Demo-Session', sessionId)
      .expect(200);
    expect(again.body.messages).toEqual([]);
  });

  it('el QR llega con su contenido para dibujarlo en la web', async () => {
    const { sessionId } = await newSession();
    const [, bot] = await say(sessionId, 'qr 0.5 café');
    expect(bot.text).toMatch(/QR para cobrar \$0\.50/);
    expect(bot.qrString).toEqual(expect.any(String));
  });

  it('respeta el monto máximo de la demo', async () => {
    const { sessionId } = await newSession();
    expect(botText(await say(sessionId, 'qr 5'))).toMatch(
      /monto máximo por cobro es de \$1\.00/,
    );
    expect(pey.qrs).toHaveLength(0);
  });

  it('limita los cobros por sesión por hora', async () => {
    const { sessionId } = await newSession();
    for (let i = 0; i < 5; i++) await say(sessionId, `qr 0.1 prueba ${i}`);
    expect(botText(await say(sessionId, 'qr 0.1 otra'))).toMatch(
      /límite de 5 cobros por hora/,
    );
    expect(pey.qrs).toHaveLength(5);
  });

  it('cada sesión ve y confirma solo lo suyo', async () => {
    const a = await newSession();
    const b = await newSession();
    await say(a.sessionId, 'cobra 1 a 5598765432 de a');
    expect(botText(await say(b.sessionId, 'sí'))).toMatch(
      /No tienes ningún cobro por confirmar/,
    );
    expect(pey.pushes).toHaveLength(0);

    const seenByB = await http
      .get('/demo/messages')
      .set('X-Demo-Session', b.sessionId)
      .expect(200);
    expect(JSON.stringify(seenByB.body)).not.toContain('5598765432');
  });

  it('rechaza con 401 una sesión inexistente, mal formada o vencida', async () => {
    await http.get('/demo/messages').expect(401);
    await http.get('/demo/messages').set('X-Demo-Session', 'abc').expect(401);
    await http
      .get('/demo/messages')
      .set('X-Demo-Session', 'a'.repeat(32))
      .expect(401);

    const { sessionId } = await newSession();
    await app
      .get(DataSource)
      .query(
        `UPDATE demo_sessions SET created_at = now() - interval '25 hours'`,
      );
    await http
      .post('/demo/messages')
      .set('X-Demo-Session', sessionId)
      .send({ text: 'hola' })
      .expect(401);
  });

  it('rechaza mensajes vacíos o de más de 300 caracteres', async () => {
    const { sessionId } = await newSession();
    await http
      .post('/demo/messages')
      .set('X-Demo-Session', sessionId)
      .send({ text: '   ' })
      .expect(400);
    await http
      .post('/demo/messages')
      .set('X-Demo-Session', sessionId)
      .send({ text: 'a'.repeat(301) })
      .expect(400);
  });

  it('limita los mensajes por sesión (30 cada 10 minutos)', async () => {
    const { sessionId } = await newSession();
    for (let i = 0; i < 30; i++) await say(sessionId, 'ayuda');
    await http
      .post('/demo/messages')
      .set('X-Demo-Session', sessionId)
      .send({ text: 'ayuda' })
      .expect(429);
  });

  it('limita las sesiones nuevas por conexión (20 por hora)', async () => {
    for (let i = 0; i < 20; i++) await newSession('203.0.113.77');
    await http
      .post('/demo/sessions')
      .set('X-Forwarded-For', '203.0.113.77')
      .expect(429);
    await newSession('203.0.113.78');
  });

  it('los visitantes no aparecen en el equipo del negocio de demo', async () => {
    await newSession();
    const admin = await loginAs(app, 'dueno', 'admin-12345');
    const team = await http
      .get('/users')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(
      (team.body as { users: { username: string }[] }).users.map(
        (u) => u.username,
      ),
    ).toEqual(['dueno']);
  });
});
