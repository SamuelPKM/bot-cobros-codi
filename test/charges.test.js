// Núcleo de cobros: reglas que valen igual para WhatsApp, la web y la demo.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createCharges } from '../src/charges.js';
import { clabeCheckDigit, isValidClabe } from '../src/clabe.js';
import { PeyError } from '../src/pey.js';
import { fakeClock, fakePey, fakeWhatsApp, freshStore, silentLog } from './helpers.js';

const LIMITS = { maxAmountCents: 100, maxChargesPerHour: 3, maxPushesPerPayerPerHour: 2 };
const VALID_CLABE = '012180015826225713'; // una de las preautorizadas de la guía del hackatón
const HOUR = 60 * 60 * 1000;

describe('CLABE', () => {
  it('acepta las CLABE preautorizadas de la guía y rechaza un dígito verificador malo', () => {
    for (const clabe of ['012180015826225713', '012180015913466252', '014180606004536217', '012180015355682429', '127180016558860385']) {
      assert.equal(isValidClabe(clabe), true, clabe);
    }
    assert.equal(isValidClabe('012180015826225714'), false);
    assert.equal(isValidClabe('01218001582622571'), false);
    assert.equal(isValidClabe('01218001582622571a'), false);
    assert.equal(clabeCheckDigit('01218001582622571'), 3);
  });
});

describe('núcleo de cobros', () => {
  let store;
  let pey;
  let outbox;
  let now;
  let charges;

  beforeEach(async () => {
    now = fakeClock();
    store = await freshStore({ now });
    pey = fakePey();
    outbox = fakeWhatsApp();
    charges = createCharges({
      store,
      pey,
      outbox,
      limits: LIMITS,
      publicBaseUrl: 'https://cobrale.example.com',
      renderQr: async (s) => Buffer.from(s),
      now,
      log: silentLog,
    });
  });

  const webCtx = (merchant) => charges.contextFor(merchant, { channel: 'web' });

  describe('modo prueba', () => {
    it('un comerciante sin CLABE propia activa está limitado', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      const result = await charges.createQr(webCtx(merchant), { amountCents: 500 });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'limit');
      assert.match(result.message, /modo prueba el monto máximo es de \$1\.00/);
    });

    it('con su CLABE activa ya no tiene límite y el dinero va a su cuenta', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      await store.updateMerchant(merchant.id, { bankAccountId: 'BA9', bankStatus: 'ACTIVE' });
      const ctx = webCtx(await store.getMerchant(merchant.id));

      const qr = await charges.createQr(ctx, { amountCents: 50_000, concept: 'tinte' });
      assert.equal(qr.ok, true);
      assert.equal(pey.qrs[0].bankAccountId, 'BA9');
      assert.equal(qr.charge.bankAccountId, 'BA9');

      const draft = await charges.draftPush(ctx, { amountCents: 20_000, payerPhone: '5512345678' });
      await charges.confirmPush(ctx, draft.charge.id);
      assert.equal(pey.pushes[0].bankAccountId, 'BA9');
    });

    it('una CLABE en validación no cuenta: sigue limitado y sin bankAccountId', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      await store.updateMerchant(merchant.id, { bankAccountId: 'BA9', bankStatus: 'PENDING' });
      const ctx = webCtx(await store.getMerchant(merchant.id));
      assert.equal(ctx.limited, true);
      assert.equal(ctx.bankAccountId, null);
    });

    it('una cuenta de confianza no tiene límite aunque no tenga CLABE', async () => {
      const merchant = await store.createMerchant({ businessName: 'Equipo', isTrusted: true });
      const result = await charges.createQr(webCtx(merchant), { amountCents: 50_000 });
      assert.equal(result.ok, true);
      assert.equal(pey.qrs[0].bankAccountId, undefined);
    });

    it('la cuenta de demostración siempre está limitada', async () => {
      const merchant = await store.createMerchant({ businessName: 'Demo', isDemo: true, isTrusted: true });
      assert.equal(webCtx(merchant).limited, true);
    });

    it('los cobros de un comerciante se comparten entre la web y WhatsApp', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo', isTrusted: true });
      await charges.createQr(charges.contextFor(merchant, { channel: 'whatsapp', notifyTo: '5215511112222' }), { amountCents: 100 });
      const summary = await charges.summary(webCtx(merchant));
      assert.equal(summary.pending.length, 1);
      assert.equal(summary.pending[0].channel, 'whatsapp');
    });
  });

  describe('push desde la web', () => {
    it('confirma el cobro indicado y no otro, aunque haya uno más reciente', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo', isTrusted: true });
      const ctx = webCtx(merchant);
      const first = await charges.draftPush(ctx, { amountCents: 100, payerPhone: '5512345678' });
      now.advance(1000);

      const result = await charges.confirmPush(ctx, first.charge.id);
      assert.equal(result.outcome, 'sent');
      assert.equal(pey.pushes[0].metadata.chargeId, String(first.charge.id));
    });

    it('no deja confirmar el cobro de otro comerciante', async () => {
      const a = await store.createMerchant({ businessName: 'A', isTrusted: true });
      const b = await store.createMerchant({ businessName: 'B', isTrusted: true });
      const draft = await charges.draftPush(webCtx(a), { amountCents: 100, payerPhone: '5512345678' });

      const result = await charges.confirmPush(webCtx(b), draft.charge.id);
      assert.equal(result.ok, false);
      assert.equal(pey.pushes.length, 0);
    });

    it('los cobros de la web no avisan por chat: la web se actualiza sola', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo', isTrusted: true });
      const qr = await charges.createQr(webCtx(merchant), { amountCents: 100 });
      await store.markPaid(qr.charge.id, { paidVia: 'qr' });
      await charges.notifyPaid(await store.getCharge(qr.charge.id));
      assert.equal(outbox.sent.length, 0);
      assert.ok((await store.getCharge(qr.charge.id)).notifiedAt);
    });
  });

  describe('QR', () => {
    it('guarda el contenido del QR para volver a dibujarlo', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo', isTrusted: true });
      const { charge } = await charges.createQr(webCtx(merchant), { amountCents: 100 });
      const png = await charges.qrPngFor(await store.getCharge(charge.id));
      assert.equal(png.toString(), '{"TYP":1,"v":"01","ic":0,"IDC":"IDC1"}');
    });
  });

  describe('cuenta bancaria del comerciante', () => {
    it('registra la CLABE en pey y la deja en validación', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      const result = await charges.registerBankAccount(merchant, { holder: ' Leonardo Pérez ', clabe: '012 180 015826225713', entity: 'PERSON' });

      assert.equal(result.ok, true);
      assert.deepEqual([...pey.bankAccounts.values()][0], {
        id: 'BA1',
        codiStatus: 'PENDING',
        alias: `Cóbrale ${merchant.id}`,
        name: 'Leonardo Pérez',
        clabe: VALID_CLABE,
        entity: 'PERSON',
      });
      const saved = await store.getMerchant(merchant.id);
      assert.equal(saved.bankStatus, 'PENDING');
      assert.equal(saved.bankClabeLast4, '5713');
      assert.equal(saved.bankHolder, 'Leonardo Pérez');
    });

    it('valida antes de llamar a pey', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      assert.match((await charges.registerBankAccount(merchant, { holder: 'X', clabe: '012180015826225714', entity: 'PERSON' })).message, /CLABE no es válida/);
      assert.match((await charges.registerBankAccount(merchant, { holder: ' ', clabe: VALID_CLABE, entity: 'PERSON' })).message, /titular/);
      assert.match((await charges.registerBankAccount(merchant, { holder: 'X', clabe: VALID_CLABE, entity: 'OTRA' })).message, /persona física o de una empresa/);
      assert.equal(pey.bankAccounts.size, 0);
    });

    it('traduce el rechazo de pey', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      pey.fail = new PeyError('clabe is not valid', { status: 400, type: 'INVALID_CLABE' });
      const result = await charges.registerBankAccount(merchant, { holder: 'X', clabe: VALID_CLABE, entity: 'PERSON' });
      assert.equal(result.ok, false);
      assert.match(result.message, /CLABE no es válida/);
    });

    it('el webhook bank.account.updated la activa, confirmando con la API', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      await charges.registerBankAccount(merchant, { holder: 'X', clabe: VALID_CLABE, entity: 'PERSON' });
      pey.setBankStatus('BA1', 'ACTIVE');

      assert.equal(await charges.handleBankAccountUpdated({ type: 'bank.account.updated', bankAccountId: 'BA1' }), 'bank_active');
      const ctx = webCtx(await store.getMerchant(merchant.id));
      assert.equal(ctx.limited, false);
      assert.equal(ctx.bankAccountId, 'BA1');
      assert.equal(await charges.handleBankAccountUpdated({ type: 'bank.account.updated', bankAccountId: 'OTRA' }), 'unknown_bank_account');
    });

    it('el barrido detecta cada hora una cuenta rechazada, porque pey no avisa por webhook', async () => {
      const merchant = await store.createMerchant({ businessName: 'Leo' });
      await charges.registerBankAccount(merchant, { holder: 'X', clabe: VALID_CLABE, entity: 'PERSON' });
      pey.setBankStatus('BA1', 'ERROR', 'La CLABE no pertenece al titular');

      await charges.sweep(); // recién registrada: todavía no se revisa
      assert.equal((await store.getMerchant(merchant.id)).bankStatus, 'PENDING');

      now.advance(HOUR + 1);
      await charges.sweep();
      const saved = await store.getMerchant(merchant.id);
      assert.equal(saved.bankStatus, 'ERROR');
      assert.equal(saved.bankError, 'La CLABE no pertenece al titular');
    });
  });

  describe('barrido con varias instancias', () => {
    it('si otra instancia está barriendo, esta no hace nada', async () => {
      let inner;
      const outer = await store.db.withLock(424242, async () => {
        inner = await charges.sweep();
      });
      assert.equal(outer, true);
      assert.equal(inner, false);
    });
  });
});
