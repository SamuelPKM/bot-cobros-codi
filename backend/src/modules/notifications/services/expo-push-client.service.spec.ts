import { ExpoPushClient } from './expo-push-client.service';

const message = (to: string) => ({
  to,
  title: 'Pago recibido',
  body: '$1.00',
  data: { chargeId: 1 },
});

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { status: 200, body: { data: [] } };
    return Promise.resolve(
      new Response(JSON.stringify(next.body), { status: next.status }),
    );
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

describe('ExpoPushClient', () => {
  it('manda los mensajes a la API de Expo y devuelve un ticket por mensaje', async () => {
    const { fetch, calls } = fakeFetch([
      {
        status: 200,
        body: {
          data: [
            { status: 'ok', id: 'T1' },
            { status: 'ok', id: 'T2' },
          ],
        },
      },
    ]);
    const client = new ExpoPushClient({ fetch, accessToken: 'secreto-expo' });

    const tickets = await client.send([
      message('ExponentPushToken[a]'),
      message('ExponentPushToken[b]'),
    ]);

    expect(tickets).toEqual([
      { status: 'ok', id: 'T1' },
      { status: 'ok', id: 'T2' },
    ]);
    expect(calls[0].url).toBe('https://exp.host/--/api/v2/push/send');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer secreto-expo',
    });
    expect(JSON.parse(calls[0].init.body as string)).toEqual([
      {
        ...message('ExponentPushToken[a]'),
        sound: 'default',
        priority: 'high',
      },
      {
        ...message('ExponentPushToken[b]'),
        sound: 'default',
        priority: 'high',
      },
    ]);
  });

  it('sin token de acceso no manda Authorization', async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { data: [{ status: 'ok' }] } },
    ]);
    await new ExpoPushClient({ fetch }).send([message('ExponentPushToken[a]')]);
    expect(calls[0].init.headers).not.toHaveProperty('Authorization');
  });

  it('parte en lotes de 100, como pide Expo', async () => {
    const ok = (n: number) => ({
      status: 200,
      body: { data: Array.from({ length: n }, () => ({ status: 'ok' })) },
    });
    const { fetch, calls } = fakeFetch([ok(100), ok(5)]);
    const messages = Array.from({ length: 105 }, (_, i) =>
      message(`ExponentPushToken[${i}]`),
    );
    const tickets = await new ExpoPushClient({ fetch }).send(messages);
    expect(calls).toHaveLength(2);
    expect(tickets).toHaveLength(105);
  });

  it('no llama a Expo si no hay mensajes', async () => {
    const { fetch, calls } = fakeFetch([]);
    await expect(new ExpoPushClient({ fetch }).send([])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('lanza si Expo responde con error HTTP, para reintentar después', async () => {
    const { fetch } = fakeFetch([
      { status: 503, body: { errors: [{ message: 'down' }] } },
    ]);
    await expect(
      new ExpoPushClient({ fetch }).send([message('ExponentPushToken[a]')]),
    ).rejects.toThrow(/503/);
  });
});
