import { WhatsAppClient } from './whatsapp-client.service';

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { status: 200, body: {} };
    return Promise.resolve(
      new Response(JSON.stringify(next.body), { status: next.status }),
    );
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const client = (fetch: typeof globalThis.fetch) =>
  new WhatsAppClient({
    token: 'token-meta',
    phoneNumberId: 'PHONE_ID',
    apiVersion: 'v23.0',
    fetch,
  });

describe('WhatsAppClient', () => {
  it('sendText manda el texto a la Graph API con el token, sin vista previa de ligas', async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { messages: [{ id: 'wamid.1' }] } },
    ]);
    await client(fetch).sendText('5215512345678', 'Hola');
    expect(calls[0].url).toBe(
      'https://graph.facebook.com/v23.0/PHONE_ID/messages',
    );
    expect(calls[0].init.headers).toMatchObject({
      Authorization: 'Bearer token-meta',
    });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '5215512345678',
      type: 'text',
      text: { body: 'Hola', preview_url: false },
    });
  });

  it('sendImage sube el PNG primero y luego lo manda por su id con el pie de foto', async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { id: 'MEDIA1' } },
      { status: 200, body: { messages: [{ id: 'wamid.2' }] } },
    ]);
    await client(fetch).sendImage(
      '5215512345678',
      Buffer.from('png'),
      'QR para cobrar',
    );
    expect(calls[0].url).toBe(
      'https://graph.facebook.com/v23.0/PHONE_ID/media',
    );
    expect(calls[0].init.body).toBeInstanceOf(FormData);
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '5215512345678',
      type: 'image',
      image: { id: 'MEDIA1', caption: 'QR para cobrar' },
    });
  });

  it('convierte el error de Meta en WhatsAppError', async () => {
    const { fetch } = fakeFetch([
      {
        status: 400,
        body: { error: { message: 'Recipient not allowed', code: 131030 } },
      },
    ]);
    await expect(
      client(fetch).sendText('5215512345678', 'x'),
    ).rejects.toMatchObject({
      name: 'WhatsAppError',
      message: 'Recipient not allowed',
      status: 400,
      code: 131030,
    });
  });
});
