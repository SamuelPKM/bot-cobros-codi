// Núcleo de cobros de Cóbrale. Lo usan igual el bot de WhatsApp, la web y la
// demo: cada canal solo traduce lo que la persona pide y cómo se le responde.
//
// Todas las funciones reciben un "contexto de comerciante" (ver `contextFor`)
// y devuelven { ok: true, ... } o { ok: false, reason, message }, donde
// `message` es un texto listo para mostrarle al comerciante.

import QRCode from 'qrcode';
import { isValidClabe } from './clabe.js';
import { payerConcept, peyErrorReason, texts } from './messages.js';
import { MIN_EXPIRATION_SECONDS } from './pey.js';

export const CONFIRMATION_WINDOW_MS = 10 * 60 * 1000; // tiempo para confirmar un push
export const QR_EXPIRATION_SECONDS = 15 * 60;
const LINK_WINDOW_MS = 24 * 60 * 60 * 1000; // tiempo para pedir la liga de un push expirado
const EXPIRATION_GRACE_MS = 20 * 1000; // margen por si el webhook de pago viene en camino
const BANK_CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada cuánto se revisa una CLABE en validación
const HOUR_MS = 60 * 60 * 1000;
const TIME_ZONE = 'America/Mexico_City';

// Rechazos de pey que pueden venir de que el cliente no tiene CoDi. No incluye los
// que son del comerciante o del servicio (cuenta inactiva, mantenimiento, monto).
const MAYBE_NO_CODI = new Set(['BAD_REQUEST', 'INVALID_REQUEST', 'INVALID_PARAMETER', 'PEY_CONSISTENCY_ERROR', 'UNKNOWN']);

/** PNG del QR, como recomienda pey: corrección de errores M, negro sobre blanco, borde 4. */
export function renderQrPng(qrString) {
  return QRCode.toBuffer(qrString, { type: 'png', errorCorrectionLevel: 'M', margin: 4, scale: 10 });
}

export function dayKey(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(ms));
}

/**
 * @param limits { maxAmountCents, maxChargesPerHour, maxPushesPerPayerPerHour }:
 *   se aplican a la demo y a los comerciantes "en modo prueba" (sin CLABE
 *   propia activa), cuyos cobros llegan a la cuenta del proyecto.
 * @param outbox { sendText(to, body) }: para avisar pagos y expiraciones a quien
 *   tenga `notifyTo` (WhatsApp o demo). La web no necesita aviso: se actualiza sola.
 */
export function createCharges({
  store,
  pey,
  outbox,
  limits,
  publicBaseUrl = null,
  renderQr = renderQrPng,
  onActivity = () => {}, // se llama cuando hay algo nuevo que puede vencer (para agendar el barrido)
  now = Date.now,
  log = console,
}) {
  // ------------------------------------------------------------ contexto

  /**
   * Quién cobra y con qué reglas.
   * @param merchant fila de `merchants`, o null para una sesión de la demo.
   * @param channel 'web' | 'whatsapp' | 'demo' | 'script'
   * @param notifyTo a dónde avisar pagos (número de WhatsApp o 'demo:<sesión>').
   */
  function contextFor(merchant, { channel, notifyTo = null, demoSession = null, demoName = null }) {
    if (!merchant) {
      return {
        merchantId: null,
        ownerKey: `demo:${demoSession}`,
        name: demoName,
        channel,
        notifyTo,
        limited: true,
        bankAccountId: null,
      };
    }
    const ownBank = merchant.bankStatus === 'ACTIVE' ? merchant.bankAccountId : null;
    return {
      merchantId: merchant.id,
      ownerKey: `m:${merchant.id}`,
      name: merchant.businessName,
      channel,
      notifyTo,
      // Sin CLABE propia activa, el dinero llega a la cuenta del proyecto: se limita.
      limited: merchant.isDemo || !(merchant.isTrusted || ownBank),
      bankAccountId: ownBank,
    };
  }

  /** Revisa los límites del modo prueba. Devuelve el texto del rechazo o null. */
  async function limitFor(ctx, { amountCents, payerPhone = null }) {
    if (!ctx.limited) return null;
    if (amountCents !== undefined && amountCents > limits.maxAmountCents) return texts.demoAmountLimit(limits.maxAmountCents);
    if ((await store.countSentByOwner(ctx.ownerKey, now() - HOUR_MS)) >= limits.maxChargesPerHour) return texts.demoTooMany();
    if (payerPhone && (await store.countPushesToPayer(payerPhone, now() - HOUR_MS)) >= limits.maxPushesPerPayerPerHour) {
      return texts.payerTooMany(payerPhone);
    }
    return null;
  }

  const fail = (reason, message) => ({ ok: false, reason, message });

  function logPeyError(charge, what, error) {
    const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
    log.error(`[cobros] cobro ${charge.id}: falló ${what} (${error.type ?? error.name}): ${error.message}${requestId}`);
  }

  async function ownedCharge(ctx, chargeId, statuses) {
    if (chargeId == null) return store.latestCharge(ctx.ownerKey, statuses);
    const charge = await store.getCharge(chargeId);
    return charge && charge.ownerKey === ctx.ownerKey && statuses.includes(charge.status) ? charge : null;
  }

  // ---------------------------------------------------------------- push

  /** Guarda un push por confirmar. Todavía no cobra nada. */
  async function draftPush(ctx, { amountCents, payerPhone, concept = null }) {
    const limited = await limitFor(ctx, { amountCents, payerPhone });
    if (limited) return fail('limit', limited);

    await store.cancelAwaiting(ctx.ownerKey);
    const charge = await store.createCharge({
      kind: 'push',
      channel: ctx.channel,
      merchantId: ctx.merchantId,
      ownerKey: ctx.ownerKey,
      notifyTo: ctx.notifyTo,
      payerPhone,
      amountCents,
      concept,
      status: 'awaiting_confirmation',
    });
    return { ok: true, charge, message: texts.confirmPrompt(charge) };
  }

  /**
   * Manda el push por confirmar: el indicado, o el más reciente si `chargeId`
   * es null (WhatsApp). Nunca manda dos veces el mismo cobro.
   */
  async function confirmPush(ctx, chargeId = null) {
    const charge = await ownedCharge(ctx, chargeId, ['awaiting_confirmation']);
    if (!charge) return fail('nothing', texts.nothingToConfirm());

    if (now() - charge.createdAt > CONFIRMATION_WINDOW_MS) {
      await store.transition(charge.id, 'awaiting_confirmation', 'cancelled');
      return fail('expired', texts.confirmationExpired());
    }
    // Los límites se revisan otra vez: entre el borrador y la confirmación pudieron salir otros cobros.
    const limited = await limitFor(ctx, { payerPhone: charge.payerPhone });
    if (limited) {
      await store.transition(charge.id, 'awaiting_confirmation', 'cancelled');
      return fail('limit', limited);
    }
    if (!(await store.transition(charge.id, 'awaiting_confirmation', 'sending'))) return fail('duplicate', null);

    const expiresAt = now() + MIN_EXPIRATION_SECONDS * 1000;
    try {
      const { transactionId, codiId } = await pey.createPush({
        amount: charge.amountCents / 100,
        phoneNumber: charge.payerPhone,
        concept: payerConcept(ctx.name, charge.concept),
        expiration: MIN_EXPIRATION_SECONDS,
        numRef: String(charge.id % 10_000_000),
        ...(ctx.bankAccountId ? { bankAccountId: ctx.bankAccountId } : {}),
        metadata: { chargeId: String(charge.id) },
      });
      const sent = await store.updateCharge(charge.id, {
        status: 'pending',
        transactionId,
        codiId,
        expiresAt,
        bankAccountId: ctx.bankAccountId,
      });
      onActivity();
      return { ok: true, outcome: 'sent', charge: sent, message: texts.sent(sent, MIN_EXPIRATION_SECONDS / 60) };
    } catch (error) {
      logPeyError(charge, 'el push', error);
      if (error.type === 'TIMEOUT' || error.type === 'NETWORK_ERROR') {
        // No se sabe si pey lo envió. Si se paga, el webhook lo liga por metadata.chargeId.
        const unknown = await store.updateCharge(charge.id, { status: 'unknown', expiresAt, error: error.message });
        onActivity();
        return { ok: true, outcome: 'unknown', charge: unknown, message: texts.sendUnknown(unknown) };
      }
      const failed = await store.updateCharge(charge.id, { status: 'failed', error: `${error.type ?? ''} ${error.message}`.trim() });
      // pey no tiene un error propio para "ese número no tiene CoDi": cuando el
      // rechazo puede deberse al teléfono, se sugiere la liga, que no necesita CoDi.
      const suggestLink = Boolean(publicBaseUrl) && MAYBE_NO_CODI.has(error.type);
      return { ...fail('pey', texts.sendFailed(failed, peyErrorReason(error), { suggestLink })), charge: failed };
    }
  }

  async function cancelPush(ctx, chargeId = null) {
    const charge = await ownedCharge(ctx, chargeId, ['awaiting_confirmation']);
    if (!charge) return fail('nothing', texts.nothingToConfirm());
    await store.transition(charge.id, 'awaiting_confirmation', 'cancelled');
    return { ok: true, charge, message: texts.cancelled(charge) };
  }

  // ------------------------------------------------------ liga y QR

  async function newCharge(ctx, kind, { amountCents, concept }) {
    return store.createCharge({
      kind,
      channel: ctx.channel,
      merchantId: ctx.merchantId,
      ownerKey: ctx.ownerKey,
      notifyTo: ctx.notifyTo,
      amountCents,
      concept,
      status: 'creating',
      bankAccountId: ctx.bankAccountId,
    });
  }

  const linkUrls = (charge) => ({
    successUrl: `${publicBaseUrl}/pago/gracias`,
    backUrl: `${publicBaseUrl}/pago/cancelado`,
    clientReferenceId: `cobro-${charge.id}`,
    metadata: { chargeId: String(charge.id) },
  });

  /**
   * Liga de pago directa: no necesita el teléfono del cliente. Las ligas se
   * liquidan a la cuenta de la API key (pey no acepta bankAccountId en ligas).
   */
  async function createLink(ctx, { amountCents, concept = null }) {
    if (!publicBaseUrl) return fail('unavailable', texts.linkUnavailable());
    const limited = await limitFor(ctx, { amountCents });
    if (limited) return fail('limit', limited);

    const charge = await newCharge(ctx, 'link', { amountCents, concept });
    try {
      const { id, url } = await pey.createPaymentLink({ amount: amountCents / 100, ...linkUrls(charge) });
      const created = await store.updateCharge(charge.id, { status: 'link', linkId: id, linkUrl: url, bankAccountId: null });
      return { ok: true, charge: created, message: texts.directLink(created) };
    } catch (error) {
      logPeyError(charge, 'la liga', error);
      const failed = await store.updateCharge(charge.id, { status: 'failed', error: `${error.type ?? ''} ${error.message}`.trim() });
      return { ...fail('pey', texts.directLinkFailed(failed, peyErrorReason(error))), charge: failed };
    }
  }

  /** QR CoDi con 15 minutos de vigencia. Devuelve también el PNG. */
  async function createQr(ctx, { amountCents, concept = null }) {
    const limited = await limitFor(ctx, { amountCents });
    if (limited) return fail('limit', limited);

    const charge = await newCharge(ctx, 'qr', { amountCents, concept });
    try {
      const qr = await pey.createQr({
        amount: amountCents / 100,
        concept: payerConcept(ctx.name, concept),
        expiration: QR_EXPIRATION_SECONDS,
        numRef: String(charge.id % 10_000_000),
        ...(ctx.bankAccountId ? { bankAccountId: ctx.bankAccountId } : {}),
        metadata: { chargeId: String(charge.id) },
      });
      // El qrString se codifica tal cual: pey pide no parsearlo ni reformatearlo.
      const png = await renderQr(qr.qrString);
      const created = await store.updateCharge(charge.id, {
        status: 'qr',
        qrId: qr.id,
        qrString: qr.qrString,
        expiresAt: now() + QR_EXPIRATION_SECONDS * 1000,
      });
      onActivity();
      return { ok: true, charge: created, png, message: texts.qrCaption(created, QR_EXPIRATION_SECONDS / 60) };
    } catch (error) {
      logPeyError(charge, 'el QR', error);
      const failed = await store.updateCharge(charge.id, { status: 'failed', error: `${error.type ?? ''} ${error.message}`.trim() });
      return { ...fail('pey', texts.qrFailed(failed, peyErrorReason(error))), charge: failed };
    }
  }

  /** Plan B: liga de pago para un push que expiró (el indicado o el más reciente). */
  async function linkForExpired(ctx, chargeId = null) {
    if (!publicBaseUrl) return fail('unavailable', texts.linkUnavailable());
    const charge = await ownedCharge(ctx, chargeId, ['expired']);
    if (!charge || charge.kind !== 'push' || now() - charge.createdAt > LINK_WINDOW_MS) {
      return fail('nothing', texts.noExpiredCharge());
    }
    if (!(await store.transition(charge.id, 'expired', 'link_creating'))) return fail('duplicate', null);

    try {
      const { id, url } = await pey.createPaymentLink({ amount: charge.amountCents / 100, ...linkUrls(charge) });
      const updated = await store.updateCharge(charge.id, { status: 'link', linkId: id, linkUrl: url, bankAccountId: null });
      return { ok: true, charge: updated, message: texts.link(updated) };
    } catch (error) {
      logPeyError(charge, 'la liga', error);
      await store.transition(charge.id, 'link_creating', 'expired');
      return fail('pey', texts.linkFailed(charge));
    }
  }

  // ----------------------------------------------------------- consultas

  async function summary(ctx) {
    const today = dayKey(now());
    const charges = (await store.listSince(ctx.ownerKey, now() - 36 * HOUR_MS)).filter((c) => dayKey(c.createdAt) === today);
    const paid = charges.filter((c) => c.status === 'paid');
    return {
      paid,
      pending: charges.filter((c) => ['pending', 'unknown', 'link', 'qr'].includes(c.status)),
      expiredCount: charges.filter((c) => c.status === 'expired').length,
      totalPaidCents: paid.reduce((sum, c) => sum + c.amountCents, 0),
    };
  }

  /** El PNG del QR de un cobro, para mostrarlo otra vez (por ejemplo en la web). */
  async function qrPngFor(charge) {
    return charge.qrString ? renderQr(charge.qrString) : null;
  }

  // ------------------------------------------------------ avisos y barrido

  /**
   * Avisa "Pagado" a `notifyTo`. Si el envío falla lanza el error y el cobro
   * queda sin `notifiedAt`, para que `sweep` lo vuelva a intentar.
   */
  async function notifyPaid(charge) {
    if (charge.notifiedAt) return;
    if (charge.notifyTo) await outbox.sendText(charge.notifyTo, texts.paid(charge));
    await store.updateCharge(charge.id, { notifiedAt: now() });
  }

  /** Busca en la API si un cobro vencido sí se pagó. Devuelve la transacción pagada o null. */
  async function findPayment(charge) {
    if (charge.kind === 'qr' && charge.qrId) {
      const items = await pey.listQrTransactions(charge.qrId);
      return items.find((tx) => tx.status === 'PAID') ?? null;
    }
    if (charge.transactionId) {
      const tx = await pey.getTransaction(charge.transactionId);
      return tx.status === 'PAID' ? tx : null;
    }
    return null;
  }

  async function expireDue() {
    for (const charge of await store.listDue(now() - EXPIRATION_GRACE_MS)) {
      try {
        const tx = await findPayment(charge);
        if (tx) {
          await store.markPaid(charge.id, {
            paidAt: tx.datePaid,
            trackingKey: tx.metadata?.trackingKey ?? null,
            paidVia: charge.kind,
            transactionId: tx.id ?? null,
          });
          await notifyPaid(await store.getCharge(charge.id));
          continue;
        }
        if (!(await store.transition(charge.id, charge.status, 'expired'))) continue;
        const canLink = charge.kind === 'push' && Boolean(publicBaseUrl);
        if (charge.notifyTo) await outbox.sendText(charge.notifyTo, texts.expired(charge, canLink));
      } catch (error) {
        // Se queda como estaba; el siguiente barrido lo vuelve a intentar.
        log.error(`[cobros] cobro ${charge.id}: no se pudo revisar la expiración: ${error.message}`);
      }
    }
  }

  async function retryNotifications() {
    for (const charge of await store.listPaidNotNotified()) {
      try {
        await notifyPaid(charge);
      } catch (error) {
        log.error(`[cobros] cobro ${charge.id}: no se pudo avisar del pago: ${error.message}`);
      }
    }
  }

  /**
   * Tarea periódica. Con varias instancias corre en una sola a la vez, gracias
   * al candado de la base. Devuelve false si otra instancia la estaba corriendo.
   */
  async function sweep() {
    return store.db.withLock(424242, async () => {
      await expireDue();
      await retryNotifications();
      await checkBankAccounts();
      await store.cleanup();
    });
  }

  // ------------------------------------------------- cuentas bancarias

  /**
   * Registra la CLABE del comerciante en pey para que sus cobros le lleguen
   * directo. Banxico la valida en hasta 5 días hábiles; mientras tanto el
   * comerciante sigue en modo prueba.
   */
  async function registerBankAccount(merchant, { holder, clabe, entity }) {
    const cleanClabe = String(clabe ?? '').replace(/\s+/g, '');
    if (!isValidClabe(cleanClabe)) return fail('invalid', texts.invalidClabe());
    if (!holder?.trim()) return fail('invalid', texts.missingHolder());
    if (!['BUSINESS', 'PERSON'].includes(entity)) return fail('invalid', texts.missingEntity());

    try {
      const account = await pey.registerBankAccount({
        alias: `Cóbrale ${merchant.id}`,
        name: holder.trim(),
        clabe: cleanClabe,
        entity,
      });
      const updated = await store.updateMerchant(merchant.id, {
        bankAccountId: account.id,
        bankStatus: account.codiStatus ?? 'PENDING',
        bankError: null,
        bankClabeLast4: cleanClabe.slice(-4),
        bankHolder: holder.trim(),
        bankCheckedAt: now(),
      });
      return { ok: true, merchant: updated, message: texts.bankRegistered() };
    } catch (error) {
      const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
      log.error(`[cobros] comerciante ${merchant.id}: falló el alta de la CLABE (${error.type}): ${error.message}${requestId}`);
      if (error.type === 'INVALID_CLABE') return fail('invalid', texts.invalidClabe());
      return fail('pey', texts.bankFailed(peyErrorReason(error)));
    }
  }

  /** Aplica a un comerciante el estado que reporta pey de su cuenta. */
  async function applyBankStatus(merchant, account) {
    return store.updateMerchant(merchant.id, {
      bankStatus: account.codiStatus,
      bankError: account.codiStatus === 'ERROR' ? (account.errorMessage ?? 'Banxico rechazó la cuenta') : null,
      bankCheckedAt: now(),
    });
  }

  /**
   * pey avisa por webhook cuando una cuenta queda ACTIVE, pero no cuando
   * Banxico la rechaza: por eso las cuentas en validación se revisan cada hora.
   */
  async function checkBankAccounts() {
    for (const merchant of await store.listBankAccountsToCheck(now() - BANK_CHECK_INTERVAL_MS)) {
      try {
        await applyBankStatus(merchant, await pey.getBankAccount(merchant.bankAccountId));
      } catch (error) {
        log.error(`[cobros] comerciante ${merchant.id}: no se pudo revisar la CLABE: ${error.message}`);
        await store.updateMerchant(merchant.id, { bankCheckedAt: now() });
      }
    }
  }

  /** Webhook bank.account.updated: se confirma con la API antes de activar. */
  async function handleBankAccountUpdated(event) {
    const merchant = await store.getMerchantByBankAccountId(event.bankAccountId);
    if (!merchant) return 'unknown_bank_account';
    const account = await pey.getBankAccount(event.bankAccountId);
    await applyBankStatus(merchant, account);
    return `bank_${String(account.codiStatus).toLowerCase()}`;
  }

  return {
    contextFor,
    draftPush,
    confirmPush,
    cancelPush,
    createLink,
    createQr,
    linkForExpired,
    summary,
    qrPngFor,
    notifyPaid,
    sweep,
    registerBankAccount,
    handleBankAccountUpdated,
  };
}
