import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMerchants } from '../src/config.js';
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
  it('parseMerchants lee "teléfono=Nombre" separados por punto y coma', () => {
    const merchants = parseMerchants('5511112222=Barbería Leo; +52 1 55 3333 4444 = Tacos Ana ;');
    assert.deepEqual([...merchants], [
      ['5511112222', 'Barbería Leo'],
      ['5533334444', 'Tacos Ana'],
    ]);
  });

  it('parseMerchants falla con un teléfono inválido o sin nombre', () => {
    assert.throws(() => parseMerchants('12345=Leo'), /MERCHANTS/);
    assert.throws(() => parseMerchants('5511112222'), /MERCHANTS/);
  });

  it('payerConcept antepone el negocio y respeta el largo máximo', () => {
    assert.equal(payerConcept('Barbería Leo', 'corte'), 'Barbería Leo: corte');
    assert.equal(payerConcept('Barbería Leo', null), 'Barbería Leo');
    assert.equal(payerConcept('Barbería Leo', 'corte de pelo, barba y tinte completo').length, 40);
  });
});
