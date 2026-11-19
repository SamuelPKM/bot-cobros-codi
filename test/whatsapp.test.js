import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { payerConcept } from '../src/messages.js';
import { createPeyClient } from '../src/pey.js';
import { createWhatsAppClient, WhatsAppError } from '../src/whatsapp.js';

describe('cliente de WhatsApp', () => {
  it('sendText manda el mensaje a la Graph API con el token', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.out' }] }), { status: 200 });
    };
    const whatsapp = createWhatsAppClient({ token: 'token-falso', phoneNumberId: '1234567890', apiVersion: 'v23.0', fetchImpl });

    await whatsapp.sendText('5215511112222', 'Hola');

    assert.equal(calls[0].url, 'https://graph.facebook.com/v23.0/1234567890/messages');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer token-falso');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      messaging_product: 'whatsapp',
      to: '5215511112222',
      type: 'text',
      text: { body: 'Hola', preview_url: false },
    });
  });

  it('convierte el error de Meta en WhatsAppError', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token', code: 190 } }), { status: 401 });
    const whatsapp = createWhatsAppClient({ token: 't', phoneNumberId: '1', fetchImpl });

    await assert.rejects(whatsapp.sendText('52155', 'Hola'), (error) => {
      assert.ok(error instanceof WhatsAppError);
      assert.equal(error.status, 401);
      assert.equal(error.code, 190);
      return true;
    });
  });
});

describe('imágenes por WhatsApp', () => {
  it('sendImage sube el PNG a /media y luego lo manda por su id', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      const body = url.endsWith('/media') ? { id: 'MEDIA123' } : { messages: [{ id: 'wamid.img' }] };
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const whatsapp = createWhatsAppClient({ token: 't', phoneNumberId: '999', fetchImpl });

    await whatsapp.sendImage('5215511112222', { png: Buffer.from('png'), caption: 'QR para cobrar' });

    assert.equal(calls[0].url, 'https://graph.facebook.com/v23.0/999/media');
    assert.ok(calls[0].init.body instanceof FormData);
    assert.equal(calls[0].init.body.get('messaging_product'), 'whatsapp');
    assert.equal(calls[0].init.body.get('file').type, 'image/png');
    assert.equal(calls[0].init.headers['Content-Type'], undefined); // fetch pone el multipart con su boundary

    assert.equal(calls[1].url, 'https://graph.facebook.com/v23.0/999/messages');
    assert.deepEqual(JSON.parse(calls[1].init.body), {
      messaging_product: 'whatsapp',
      to: '5215511112222',
      type: 'image',
      image: { id: 'MEDIA123', caption: 'QR para cobrar' },
    });
  });

  it('si la subida falla no manda el mensaje', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ error: { message: 'bad media', code: 100 } }), { status: 400 });
    };
    const whatsapp = createWhatsAppClient({ token: 't', phoneNumberId: '999', fetchImpl });

    await assert.rejects(whatsapp.sendImage('52155', { png: Buffer.from('x') }), WhatsAppError);
    assert.equal(calls.length, 1);
  });
});

describe('QR en el cliente de pey', () => {
  it('createQr manda POST /codi/qr y exige expiración', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'IDC1', qrString: '{}', qrImage: null }), { status: 201 });
    };
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });

    await pey.createQr({ amount: 150, concept: 'corte', expiration: 900, numRef: '7', metadata: { chargeId: '7' } });
    assert.equal(calls[0].url, 'https://api.pey.mx/codi/qr');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      amount: 150,
      expiration: 900,
      generateImage: false,
      concept: 'corte',
      numRef: '7',
      metadata: { chargeId: '7' },
    });

    // Sin expiración el QR no expira y acepta varios pagos: se rechaza antes de llamar.
    await assert.rejects(pey.createQr({ amount: 1, expiration: 0 }), { type: 'INVALID_PARAMETER' });
    await assert.rejects(pey.createQr({ amount: 0, expiration: 900 }), { type: 'INVALID_AMOUNT' });
    assert.equal(calls.length, 1);
  });

  it('listQrTransactions devuelve los items de la primera página', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ items: [{ id: 'TX1', status: 'PAID' }], nextToken: null }), { status: 200 });
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });
    assert.deepEqual(await pey.listQrTransactions('IDC1'), [{ id: 'TX1', status: 'PAID' }]);
  });
});

describe('ligas de pago en el cliente de pey', () => {
  it('createPaymentLink manda POST /payment-link/create', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'LINK1', url: 'https://app.mipey.mx/payment-link/LINK1' }), { status: 200 });
    };
    const pey = createPeyClient({ apiKey: 'k', fetchImpl });

    const link = await pey.createPaymentLink({
      amount: 150,
      successUrl: 'https://bot.example.com/pago/gracias',
      backUrl: 'https://bot.example.com/pago/cancelado',
      clientReferenceId: 'cobro-7',
    });

    assert.equal(link.id, 'LINK1');
    assert.equal(calls[0].url, 'https://api.pey.mx/payment-link/create');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      amount: 150,
      successUrl: 'https://bot.example.com/pago/gracias',
      backUrl: 'https://bot.example.com/pago/cancelado',
      clientReferenceId: 'cobro-7',
    });
  });

  it('rechaza URLs de regreso que no son HTTPS sin llamar a pey', async () => {
    let called = false;
    const pey = createPeyClient({ apiKey: 'k', fetchImpl: async () => { called = true; } });

    await assert.rejects(
      pey.createPaymentLink({ amount: 1, successUrl: 'http://localhost:3000/ok', backUrl: 'https://x.mx/no' }),
      { type: 'INVALID_URL' },
    );
    assert.equal(called, false);
  });
});

describe('configuración', () => {

  it('payerConcept antepone el negocio y respeta el largo máximo', () => {
    assert.equal(payerConcept('Barbería Leo', 'corte'), 'Barbería Leo: corte');
    assert.equal(payerConcept('Barbería Leo', null), 'Barbería Leo');
    assert.equal(payerConcept('Barbería Leo', 'corte de pelo, barba y tinte completo').length, 40);
  });
});
