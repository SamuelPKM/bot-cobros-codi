import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createBot } from '../src/bot.js';
import { createCharges } from '../src/charges.js';
import { PeyError } from '../src/pey.js';
import { fakeClock, fakePey, fakeWhatsApp, freshStore, silentLog } from './helpers.js';

const MERCHANT = '5215511112222'; // como lo entrega WhatsApp
const MERCHANT_PHONE = '5511112222';
const MINUTE = 60 * 1000;

// Límites del modo prueba (demo y comerciantes sin CLABE propia).
const LIMITS = { maxAmountCents: 100, maxChargesPerHour: 3, maxPushesPerPayerPerHour: 2 };

describe('bot', () => {
  let store;
  let pey;
  let whatsapp;
  let now;
  let bot;
  let charges;
  let merchant;
  let owner;

  const say = (text, from = MERCHANT) => bot.handleMessage({ from, text });
  const lastCharge = async () => (await store.listSince(owner, 0)).at(-1);

  /** `demo`: activa la demo; `publicBaseUrl: null` apaga las ligas. */
  function makeBot({ publicBaseUrl = 'https://bot.example.com', demo = null } = {}) {
    charges = createCharges({
      store,
      pey,
      outbox: whatsapp,
      limits: LIMITS,
      publicBaseUrl,
      renderQr: async (qrString) => Buffer.from(`PNG:${qrString}`),
      now,
      log: silentLog,
    });
    return createBot({ store, charges, outbox: whatsapp, demo, webUrl: 'https://cobrale.example.com', log: silentLog });
  }

  beforeEach(async () => {
    now = fakeClock();
    store = await freshStore({ now });
    pey = fakePey();
    whatsapp = fakeWhatsApp();
    // Comerciante de confianza (sin límites del modo prueba) con su WhatsApp ligado.
    merchant = await store.createMerchant({ businessName: 'Barbería Leo', whatsappPhone: MERCHANT_PHONE, isTrusted: true });
    owner = `m:${merchant.id}`;
    bot = makeBot();
  });

  describe('cobro con confirmación', () => {
    it('pide confirmación y no cobra nada hasta el "sí"', async () => {
      await say('cobra 150 a 5512345678 corte de pelo');

      assert.equal(pey.pushes.length, 0);
      assert.equal((await lastCharge()).status, 'awaiting_confirmation');
      assert.match(whatsapp.last(), /Vas a cobrar \$150\.00 al 55 1234 5678 por "corte de pelo"/);
      assert.match(whatsapp.last(), /Responde \*sí\*/);
      assert.equal(whatsapp.sent[0].to, MERCHANT);
    });

    it('con "sí" manda el push con el ID interno en metadata y el negocio en el concepto', async () => {
      await say('cobra 150 a 5512345678 corte de pelo');
      await say('Sí');

      const charge = (await lastCharge());
      assert.deepEqual(pey.pushes, [
        {
          amount: 150,
          phoneNumber: '5512345678',
          concept: 'Barbería Leo: corte de pelo',
          expiration: 360,
          numRef: String(charge.id),
          metadata: { chargeId: String(charge.id) },
        },
      ]);
      assert.equal(charge.status, 'pending');
      assert.equal(charge.transactionId, 'TX1');
      assert.equal(charge.expiresAt, now() + 6 * MINUTE);
      assert.match(whatsapp.last(), /Listo, envié el cobro de \$150\.00 al 55 1234 5678/);
      assert.match(whatsapp.last(), /6 minutos/);
    });

    it('acepta variantes de sí: "si", "¡Sí!", "ok", "confirmar"', async () => {
      for (const yes of ['si', '¡Sí!', 'OK', 'confirmar']) {
        await say('cobra 10 a 5512345678');
        await say(yes);
      }
      assert.equal(pey.pushes.length, 4);
    });

    it('con "no" cancela y no cobra', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('no');

      assert.equal(pey.pushes.length, 0);
      assert.equal((await lastCharge()).status, 'cancelled');
      assert.match(whatsapp.last(), /Cancelado/);
    });

    it('un segundo "sí" no manda otro cobro', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
      await say('sí');

      assert.equal(pey.pushes.length, 1);
      assert.match(whatsapp.last(), /No tienes ningún cobro por confirmar/);
    });

    it('un cobro nuevo reemplaza al que estaba por confirmar', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('cobra 200 a 5512345678 corte y barba');
      await say('sí');

      assert.equal(pey.pushes.length, 1);
      assert.equal(pey.pushes[0].amount, 200);
      assert.deepEqual((await store.listSince(owner, 0)).map((c) => c.status), ['cancelled', 'pending']);
    });

    it('no envía si el "sí" llega después de 10 minutos', async () => {
      await say('cobra 150 a 5512345678 corte');
      now.advance(11 * MINUTE);
      await say('sí');

      assert.equal(pey.pushes.length, 0);
      assert.equal((await lastCharge()).status, 'cancelled');
      assert.match(whatsapp.last(), /caducó/);
    });

    it('"sí" sin cobro pendiente explica cómo crear uno', async () => {
      await say('sí');
      assert.match(whatsapp.last(), /No tienes ningún cobro por confirmar/);
    });
  });

  describe('errores al enviar', () => {
    it('si pey rechaza el cobro, lo marca fallido y explica por qué', async () => {
      await say('cobra 150 a 5512345678 corte');
      pey.fail = new PeyError('account is not active', { status: 400, type: 'INVALID_STATE', requestId: 'r1' });
      await say('sí');

      assert.equal((await lastCharge()).status, 'failed');
      assert.match(whatsapp.last(), /No se pudo enviar el cobro/);
      assert.match(whatsapp.last(), /todavía no está activa en CoDi/);
      // El problema es la cuenta del comerciante, no el cliente: no se sugiere la liga.
      assert.doesNotMatch(whatsapp.last(), /no tiene CoDi activo/);
    });

    it('si el rechazo puede ser porque el cliente no tiene CoDi, sugiere la liga con el mismo monto y concepto', async () => {
      await say('cobra 150 a 5512345678 corte de pelo');
      pey.fail = new PeyError('phone not registered', { status: 400, type: 'BAD_REQUEST' });
      await say('sí');

      assert.match(whatsapp.last(), /No se pudo enviar el cobro de \$150\.00/);
      assert.match(whatsapp.last(), /Si tu cliente no tiene CoDi activo, mándale una liga de pago, que también acepta tarjeta: \*liga 150 corte de pelo\*/);
    });

    it('la liga sugerida conserva los centavos y funciona sin concepto', async () => {
      await say('cobra 80.50 a 5512345678');
      pey.fail = new PeyError('rechazado', { status: 400, type: 'INVALID_REQUEST' });
      await say('sí');
      assert.match(whatsapp.last(), /\*liga 80\.50\*/);

      await say('liga 80.50');
      assert.equal(pey.links.at(-1).amount, 80.5);
    });

    it('sin ligas configuradas no sugiere la liga', async () => {
      bot = makeBot({ publicBaseUrl: null });
      await say('cobra 150 a 5512345678 corte');
      pey.fail = new PeyError('rechazado', { status: 400, type: 'BAD_REQUEST' });
      await say('sí');
      assert.doesNotMatch(whatsapp.last(), /liga/);
    });

    it('si se corta la conexión, queda en "unknown" y pide no repetirlo', async () => {
      await say('cobra 150 a 5512345678 corte');
      pey.fail = new PeyError('timeout', { type: 'TIMEOUT' });
      await say('sí');

      assert.equal((await lastCharge()).status, 'unknown');
      assert.equal(pey.pushes.length, 1); // no hubo reintento automático
      assert.match(whatsapp.last(), /No pude confirmar si el cobro/);
      assert.match(whatsapp.last(), /No lo repitas todavía/);
    });
  });

  describe('quién puede usar el bot', () => {
    it('rechaza a un número que no está ligado a ninguna cuenta y le dice dónde registrarse', async () => {
      await say('cobra 150 a 5512345678 corte', '5215599990000');

      assert.equal(pey.pushes.length + (await store.listSince(owner, 0)).length, 0);
      assert.match(whatsapp.last(), /todavía no está ligado a una cuenta de Cóbrale/);
      assert.match(whatsapp.last(), /https:\/\/cobrale\.example\.com/);
    });

    it('"vincular <código>" liga el número a la cuenta dueña del código', async () => {
      const other = await store.createMerchant({ businessName: 'Tacos Ana' });
      await store.updateMerchant(other.id, { linkCode: '123456', linkCodeExpiresAt: now() + 15 * MINUTE });

      await say('Vincular 123456', '5215599990000');

      assert.match(whatsapp.last(), /quedó ligado a \*Tacos Ana\*/);
      assert.equal((await store.getMerchant(other.id)).whatsappPhone, '5599990000');
      assert.equal((await store.getMerchant(other.id)).linkCode, null); // el código ya no sirve

      // Sin CLABE propia queda en modo prueba: cobros pequeños.
      await say('cobra 0.50 a 5512345678 corte', '5215599990000');
      assert.equal((await store.listSince(`m:${other.id}`, 0)).length, 1);
    });

    it('rechaza un código de vinculación vencido o inexistente', async () => {
      const other = await store.createMerchant({ businessName: 'Tacos Ana' });
      await store.updateMerchant(other.id, { linkCode: '123456', linkCodeExpiresAt: now() + 15 * MINUTE });
      now.advance(16 * MINUTE);

      await say('vincular 123456', '5215599990000');
      assert.match(whatsapp.last(), /no es válido o ya venció/);
      await say('vincular 999999', '5215599990000');
      assert.match(whatsapp.last(), /no es válido o ya venció/);
      assert.equal((await store.getMerchant(other.id)).whatsappPhone, null);
    });

    it('responde con ayuda a saludos y a mensajes que no entiende', async () => {
      await say('hola');
      assert.match(whatsapp.last(), /cobra 150 a 5512345678/);
      await say('¿cuánto cuesta?');
      assert.match(whatsapp.last(), /No entendí el mensaje/);
    });

    it('explica el error cuando el comando de cobro viene mal', async () => {
      await say('cobra 150 a 12345 corte');
      assert.match(whatsapp.last(), /10 dígitos/);
      assert.equal((await lastCharge()), undefined);
    });

    it('avisa que solo entiende texto si llega una imagen o un audio', async () => {
      await bot.handleMessage({ from: MERCHANT, text: null });
      assert.match(whatsapp.last(), /Solo entiendo mensajes de texto/);
    });
  });

  describe('aviso de pago', () => {
    it('avisa "Pagado" una sola vez', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
      const charge = (await lastCharge());
      await store.markPaid(charge.id, { paidAt: 1790724758, trackingKey: 'RASTREO1', paidVia: 'push' });

      await charges.notifyPaid(await store.getCharge(charge.id));
      await charges.notifyPaid(await store.getCharge(charge.id));

      const notices = whatsapp.sent.filter((m) => m.body.includes('Pagado'));
      assert.equal(notices.length, 1);
      assert.match(notices[0].body, /✅ Pagado: \$150\.00 al 55 1234 5678 por "corte"/);
      assert.match(notices[0].body, /Clave de rastreo: RASTREO1/);
    });

    it('si WhatsApp falla, el barrido reintenta el aviso', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
      const charge = (await lastCharge());
      await store.markPaid(charge.id, { paidVia: 'push' });

      whatsapp.fail = true;
      await assert.rejects(charges.notifyPaid(await store.getCharge(charge.id)));
      assert.equal((await store.getCharge(charge.id)).notifiedAt, null);

      await charges.sweep();
      assert.match(whatsapp.last(), /✅ Pagado/);
      assert.equal((await store.getCharge(charge.id)).notifiedAt, now());
    });
  });

  describe('expiración', () => {
    beforeEach(async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
    });

    it('no expira antes de tiempo', async () => {
      now.advance(6 * MINUTE);
      await charges.sweep();
      assert.equal((await lastCharge()).status, 'pending');
    });

    it('expira el cobro vencido y ofrece la liga', async () => {
      now.advance(7 * MINUTE);
      await charges.sweep();

      assert.equal((await lastCharge()).status, 'expired');
      assert.match(whatsapp.last(), /⏰ El cobro de \$150\.00 al 55 1234 5678 por "corte" expiró/);
      assert.match(whatsapp.last(), /Si tu cliente no tiene CoDi activo, no le llegó la solicitud/);
      assert.match(whatsapp.last(), /Responde \*liga\*/);
      assert.match(whatsapp.last(), /también acepta tarjeta/);
    });

    it('avisa de la expiración una sola vez', async () => {
      now.advance(7 * MINUTE);
      await charges.sweep();
      await charges.sweep();
      assert.equal(whatsapp.sent.filter((m) => m.body.includes('expiró')).length, 1);
    });

    it('si la API dice que sí se pagó, lo marca pagado en vez de expirarlo', async () => {
      pey.pay('TX1');
      now.advance(7 * MINUTE);
      await charges.sweep();

      assert.equal((await lastCharge()).status, 'paid');
      assert.match(whatsapp.last(), /✅ Pagado/);
    });

    it('si no puede consultar la API, no expira y lo reintenta después', async () => {
      now.advance(7 * MINUTE);
      pey.fail = new PeyError('timeout', { type: 'TIMEOUT' });
      await charges.sweep();
      assert.equal((await lastCharge()).status, 'pending');

      await charges.sweep();
      assert.equal((await lastCharge()).status, 'expired');
    });

    it('sin URL pública no ofrece la liga', async () => {
      bot = makeBot({ publicBaseUrl: null });
      now.advance(7 * MINUTE);
      await charges.sweep();
      assert.doesNotMatch(whatsapp.last(), /liga/);
    });
  });

  describe('plan B: liga de pago', () => {
    async function expireCharge() {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
      now.advance(7 * MINUTE);
      await charges.sweep();
    }

    it('"liga" genera la liga del cobro expirado y se la manda al comerciante', async () => {
      await expireCharge();
      await say('liga');

      const charge = (await lastCharge());
      assert.deepEqual(pey.links, [
        {
          amount: 150,
          successUrl: 'https://bot.example.com/pago/gracias',
          backUrl: 'https://bot.example.com/pago/cancelado',
          clientReferenceId: `cobro-${charge.id}`,
          metadata: { chargeId: String(charge.id) },
        },
      ]);
      assert.equal(charge.status, 'link');
      assert.equal(charge.linkId, 'LINK1');
      assert.match(whatsapp.last(), /https:\/\/app\.mipey\.mx\/payment-link\/LINK1/);
      assert.match(whatsapp.last(), /Reenvíasela a tu cliente/);
    });

    it('un segundo "liga" no genera otra', async () => {
      await expireCharge();
      await say('liga');
      await say('liga');

      assert.equal(pey.links.length, 1);
      assert.match(whatsapp.last(), /No tienes ningún cobro expirado/);
    });

    it('si pey falla, el cobro sigue expirado y se puede volver a pedir', async () => {
      await expireCharge();
      pey.fail = new PeyError('mantenimiento', { status: 503, type: 'SERVICE_UNAVAILABLE' });
      await say('liga');
      assert.equal((await lastCharge()).status, 'expired');
      assert.match(whatsapp.last(), /No pude generar la liga/);

      await say('liga');
      assert.equal((await lastCharge()).status, 'link');
    });

    it('sin cobros expirados lo dice', async () => {
      await say('liga');
      assert.match(whatsapp.last(), /No tienes ningún cobro expirado/);
    });

    it('sin URL pública avisa que no está configurado', async () => {
      await expireCharge();
      bot = makeBot({ publicBaseUrl: null });
      await say('liga');
      assert.equal(pey.links.length, 0);
      assert.match(whatsapp.last(), /todavía no están configuradas/);
    });
  });

  describe('liga directa: "liga 150 corte"', () => {
    it('genera la liga sin pedir teléfono ni confirmación', async () => {
      await say('liga 150 corte de pelo');

      const charge = (await lastCharge());
      assert.equal(charge.kind, 'link');
      assert.equal(charge.status, 'link');
      assert.equal(charge.payerPhone, null);
      assert.equal(pey.pushes.length, 0);
      assert.deepEqual(pey.links, [
        {
          amount: 150,
          successUrl: 'https://bot.example.com/pago/gracias',
          backUrl: 'https://bot.example.com/pago/cancelado',
          clientReferenceId: `cobro-${charge.id}`,
          metadata: { chargeId: String(charge.id) },
        },
      ]);
      assert.match(whatsapp.last(), /Esta es tu liga para cobrar \$150\.00 por "corte de pelo"/);
      assert.match(whatsapp.last(), /https:\/\/app\.mipey\.mx\/payment-link\/LINK1/);
    });

    it('acepta "$", "de" y "por", y el concepto es opcional', async () => {
      await say('Liga de $80.50 por barba');
      assert.equal(pey.links[0].amount, 80.5);
      assert.equal((await lastCharge()).concept, 'barba');

      await say('liga 20');
      assert.equal((await lastCharge()).concept, null);
    });

    it('explica cómo usarla si falta el monto', async () => {
      await say('liga corte');
      assert.match(whatsapp.last(), /Escribe el monto después de "liga"\. Ejemplo: liga 150 corte de pelo/);
      assert.equal(pey.links.length, 0);
    });

    it('si pey falla, el cobro queda fallido y se explica', async () => {
      pey.fail = new PeyError('mantenimiento', { status: 503, type: 'SERVICE_UNAVAILABLE' });
      await say('liga 150 corte');

      assert.equal((await lastCharge()).status, 'failed');
      assert.match(whatsapp.last(), /No pude generar la liga de \$150\.00/);
      assert.match(whatsapp.last(), /mantenimiento/);
    });

    it('sin URL pública avisa que las ligas no están configuradas', async () => {
      bot = makeBot({ publicBaseUrl: null });
      await say('liga 150 corte');
      assert.match(whatsapp.last(), /todavía no están configuradas/);
      assert.equal((await lastCharge()), undefined);
    });
  });

  describe('QR: "qr 150 corte"', () => {
    it('crea el QR con expiración de 15 minutos y manda la imagen al comerciante', async () => {
      await say('qr 150 corte de pelo');

      const charge = (await lastCharge());
      assert.deepEqual(pey.qrs, [
        {
          amount: 150,
          concept: 'Barbería Leo: corte de pelo',
          expiration: 900,
          numRef: String(charge.id),
          metadata: { chargeId: String(charge.id) },
        },
      ]);
      assert.equal(charge.kind, 'qr');
      assert.equal(charge.status, 'qr');
      assert.equal(charge.qrId, 'IDC1');
      assert.equal(charge.expiresAt, now() + 15 * MINUTE);

      const sent = whatsapp.sent.at(-1);
      assert.equal(sent.to, MERCHANT);
      assert.equal(sent.png.toString(), 'PNG:{"TYP":1,"v":"01","ic":0,"IDC":"IDC1"}'); // el qrString va tal cual
      assert.match(sent.body, /QR para cobrar \$150\.00 por "corte de pelo"/);
      assert.match(sent.body, /Vence en 15 minutos/);
    });

    it('si pey falla, no manda imagen y explica por qué', async () => {
      pey.fail = new PeyError('account is not active', { status: 400, type: 'INVALID_STATE' });
      await say('qr 150 corte');

      assert.equal((await lastCharge()).status, 'failed');
      assert.equal(whatsapp.sent.at(-1).png, undefined);
      assert.match(whatsapp.last(), /No pude generar el QR/);
      assert.match(whatsapp.last(), /todavía no está activa en CoDi/);
    });

    it('explica cómo usarlo si falta el monto', async () => {
      await say('qr');
      assert.match(whatsapp.last(), /Ejemplo: qr 150 corte de pelo/);
    });

    it('expira el QR vencido sin pago y lo avisa', async () => {
      await say('qr 150 corte');
      now.advance(16 * MINUTE);
      await charges.sweep();

      assert.equal((await lastCharge()).status, 'expired');
      assert.match(whatsapp.last(), /⏰ El QR de \$150\.00 por "corte" expiró/);
      assert.doesNotMatch(whatsapp.last(), /Responde \*liga\*/);
    });

    it('si el QR se pagó y no llegó el webhook, el barrido lo detecta', async () => {
      await say('qr 150 corte');
      const transactionId = pey.payQr('IDC1');
      now.advance(16 * MINUTE);
      await charges.sweep();

      const charge = (await lastCharge());
      assert.equal(charge.status, 'paid');
      assert.equal(charge.paidVia, 'qr');
      assert.equal(charge.transactionId, transactionId);
      assert.match(whatsapp.last(), /✅ Pagado: \$150\.00 con QR por "corte"/);
      assert.match(whatsapp.last(), /Clave de rastreo: RASTREOQR/);
    });

    it('"liga" sola no convierte en liga un QR expirado', async () => {
      await say('qr 150 corte');
      now.advance(16 * MINUTE);
      await charges.sweep();
      await say('liga');

      assert.equal(pey.links.length, 0);
      assert.match(whatsapp.last(), /No tienes ningún cobro expirado/);
    });

    it('el resumen cuenta QR y ligas pendientes', async () => {
      await say('qr 150 corte');
      await say('liga 80 barba');
      await say('resumen');

      assert.match(whatsapp.last(), /Pendientes \(2\):/);
      assert.match(whatsapp.last(), /• \$150\.00 con QR por "corte"/);
      assert.match(whatsapp.last(), /• \$80\.00 con liga de pago por "barba"/);
    });

    it('la ayuda menciona liga y QR', async () => {
      await say('ayuda');
      assert.match(whatsapp.last(), /\*liga 150 corte de pelo\*/);
      assert.match(whatsapp.last(), /\*qr 150 corte de pelo\*/);
    });
  });

  describe('comerciante de la demo web', () => {
    const DEMO = 'demo:0123456789abcdef0123456789abcdef';
    const demo = { merchantName: 'Negocio de prueba' };
    const demoSay = (text, from = DEMO) => bot.handleMessage({ from, text });
    const demoCharges = (from = DEMO) => store.listSince(from, 0);

    beforeEach(() => {
      bot = makeBot({ demo });
    });

    it('sin demo configurada, una sesión de demo no puede cobrar', async () => {
      bot = makeBot();
      await demoSay('cobra 0.01 a 5512345678 prueba');
      assert.match(whatsapp.last(), /todavía no está ligado/);
    });

    it('cobra con el nombre del negocio de demo', async () => {
      await demoSay('cobra 0.01 a 5512345678 prueba');
      await demoSay('sí');

      assert.equal(pey.pushes[0].concept, 'Negocio de prueba: prueba');
      assert.equal((await demoCharges())[0].ownerKey, DEMO);
      assert.equal((await demoCharges())[0].merchantId, null);
      assert.equal(whatsapp.sent.at(-1).to, DEMO);
    });

    it('rechaza montos arriba del máximo, en push, liga y QR', async () => {
      for (const text of ['cobra 1.01 a 5512345678 prueba', 'liga 5 prueba', 'qr 2 prueba']) {
        await demoSay(text);
        assert.match(whatsapp.last(), /el monto máximo es de \$1\.00/);
      }
      assert.equal((await demoCharges()).length, 0);
    });

    it('limita los cobros por hora de cada sesión', async () => {
      await demoSay('qr 0.01 uno');
      await demoSay('liga 0.01 dos');
      await demoSay('qr 0.01 tres');
      await demoSay('qr 0.01 cuatro');

      assert.equal(pey.qrs.length + pey.links.length, 3);
      assert.match(whatsapp.last(), /límite de cobros por hora del modo prueba/);

      now.advance(61 * MINUTE);
      await demoSay('qr 0.01 cinco');
      assert.equal(pey.qrs.length, 3);
    });

    it('limita los push a un mismo teléfono, aunque vengan de sesiones distintas', async () => {
      const other = 'demo:ffffffffffffffffffffffffffffffff';
      await demoSay('cobra 0.01 a 5512345678 uno');
      await demoSay('sí');
      await demoSay('cobra 0.01 a 5512345678 dos', other);
      await demoSay('sí', other);
      await demoSay('cobra 0.01 a 5512345678 tres', other);

      assert.equal(pey.pushes.length, 2);
      assert.match(whatsapp.last(), /Ya se mandaron varios cobros al 55 1234 5678/);
    });

    it('revisa el límite otra vez al confirmar', async () => {
      const other = 'demo:ffffffffffffffffffffffffffffffff';
      await demoSay('cobra 0.01 a 5512345678 uno');
      await demoSay('cobra 0.01 a 5512345678 dos', other);
      await demoSay('cobra 0.01 a 5512345678 tres', 'demo:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
      await demoSay('sí');
      await demoSay('sí', other);
      await demoSay('sí', 'demo:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');

      assert.equal(pey.pushes.length, 2);
      assert.equal((await demoCharges('demo:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'))[0].status, 'cancelled');
    });

    it('los límites de la demo no aplican a los comerciantes de WhatsApp', async () => {
      await say('cobra 500 a 5512345678 corte');
      await say('sí');
      assert.equal(pey.pushes[0].amount, 500);
    });
  });

  describe('resumen del día', () => {
    it('suma lo pagado y lista lo pendiente y lo expirado de hoy', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
      await store.markPaid((await lastCharge()).id, { paidVia: 'push' });

      await say('cobra 80.50 a 5587654321 barba');
      await say('sí');
      await store.markPaid((await lastCharge()).id, { paidVia: 'push' });

      await say('cobra 300 a 5500001111 tinte');
      await say('sí');

      await say('cobra 50 a 5500002222 cejas');
      await say('sí');
      await store.transition((await lastCharge()).id, 'pending', 'expired');

      await say('resumen');

      const summary = whatsapp.last();
      assert.match(summary, /Cobrado: \$230\.50 en 2 cobros/);
      assert.match(summary, /Pendientes \(1\):\n• \$300\.00 al 55 0000 1111 por "tinte"/);
      assert.match(summary, /Expirados sin pagar: 1/);
    });

    it('no cuenta los cobros de ayer', async () => {
      await say('cobra 150 a 5512345678 corte');
      await say('sí');
      await store.markPaid((await lastCharge()).id, { paidVia: 'push' });

      now.advance(24 * 60 * MINUTE);
      await say('resumen');
      assert.match(whatsapp.last(), /Hoy todavía no has enviado cobros/);
    });
  });
});
