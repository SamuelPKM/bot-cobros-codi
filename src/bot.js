// Lógica del bot: qué hacer con cada mensaje del comerciante y con cada pago.
//
// No sabe nada de HTTP: recibe la base de datos, el cliente de pey y un
// `outbox` para responder (WhatsApp, o la conversación de la demo web), así que
// se puede probar completo con dobles.

import QRCode from 'qrcode';
import { normalizePhone, parseAmountCommand, parseCommand } from './command.js';
import { payerConcept, peyErrorReason, texts } from './messages.js';
import { MIN_EXPIRATION_SECONDS, toCents } from './pey.js';

const CONFIRMATION_WINDOW_MS = 10 * 60 * 1000; // tiempo para responder "sí"
const LINK_WINDOW_MS = 24 * 60 * 60 * 1000; // tiempo para pedir la liga de un cobro expirado
const EXPIRATION_GRACE_MS = 20 * 1000; // margen por si el webhook de pago viene en camino
const HOUR_MS = 60 * 60 * 1000;
export const QR_EXPIRATION_SECONDS = 15 * 60;
const TIME_ZONE = 'America/Mexico_City';

const YES = new Set(['si', 's', 'ok', 'va', 'dale', 'confirmar', 'confirmo', 'enviar']);
const NO = new Set(['no', 'n', 'cancelar', 'cancela']);
const HELP = new Set(['ayuda', 'hola', 'menu', 'help', 'buenas', 'buenos dias', 'buenas tardes']);

/** Minúsculas, sin acentos ni signos: "¡Sí!" -> "si". */
function simplify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dayKey(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(ms));
}

/** PNG del QR, como recomienda pey: corrección de errores M, negro sobre blanco, borde 4. */
export function renderQrPng(qrString) {
  return QRCode.toBuffer(qrString, { type: 'png', errorCorrectionLevel: 'M', margin: 4, scale: 10 });
}

/**
 * @param outbox { sendText(to, body), sendImage(to, { png, caption }) }.
 * @param merchants Map de teléfono (10 dígitos) -> nombre del negocio. Solo
 *   estos números pueden mandar cobros por WhatsApp.
 * @param publicBaseUrl URL pública HTTPS del servidor; hace falta para las ligas.
 * @param demo Opcional: { merchantName, maxAmountCents, maxChargesPerHour,
 *   maxPushesPerPayerPerHour }. Activa a los comerciantes de la demo web
 *   (los que escriben desde "demo:<sesión>") con esos límites.
 */
export function createBot({
  db,
  pey,
  outbox,
  merchants,
  publicBaseUrl = null,
  demo = null,
  renderQr = renderQrPng,
  now = Date.now,
  log = console,
}) {
  async function reply(to, body) {
    await outbox.sendText(to, body);
  }

  function resolveMerchant(from) {
    if (demo && String(from).startsWith('demo:')) {
      return { phone: from, waId: from, name: demo.merchantName, isDemo: true };
    }
    const phone = normalizePhone(from);
    const name = phone ? merchants.get(phone) : undefined;
    return name ? { phone, waId: from, name, isDemo: false } : null;
  }

  async function handleMessage({ from, text }) {
    const merchant = resolveMerchant(from);
    if (!merchant) return reply(from, texts.notRegistered());
    if (text === null) return reply(from, texts.onlyText());

    const simple = simplify(text);

    if (YES.has(simple)) return confirm(merchant);
    if (NO.has(simple)) return cancel(merchant);
    if (simple === 'liga') return sendLinkForExpired(merchant);
    if (simple === 'resumen' || simple === 'pendientes') return summary(merchant);
    if (HELP.has(simple)) return reply(merchant.waId, texts.help());
    if (/^cobra/.test(simple)) return draft(merchant, text);
    if (/^(liga|qr)( |$)/.test(simple)) return chargeWithoutPhone(merchant, text);
    return reply(merchant.waId, texts.notUnderstood());
  }

  /**
   * Límites de la demo pública: monto máximo, cobros por hora de cada sesión
   * y push por hora a un mismo teléfono, para que nadie la use para molestar.
   * Devuelve el texto del rechazo, o null si se puede seguir.
   */
  function demoLimit(merchant, { amountCents, payerPhone = null }) {
    if (!merchant.isDemo) return null;
    if (amountCents !== undefined && amountCents > demo.maxAmountCents) return texts.demoAmountLimit(demo.maxAmountCents);
    if (db.countSentByMerchant(merchant.phone, now() - HOUR_MS) >= demo.maxChargesPerHour) return texts.demoTooMany();
    if (payerPhone && db.countPushesToPayer(payerPhone, now() - HOUR_MS) >= demo.maxPushesPerPayerPerHour) {
      return texts.payerTooMany(payerPhone);
    }
    return null;
  }

  /** "cobra 150 a 55..." -> guarda el cobro y pide confirmación. Todavía no cobra nada. */
  async function draft(merchant, text) {
    const parsed = parseCommand(text);
    if (!parsed.ok) return reply(merchant.waId, parsed.error);

    const amountCents = toCents(parsed.amount);
    const limited = demoLimit(merchant, { amountCents, payerPhone: parsed.phoneNumber });
    if (limited) return reply(merchant.waId, limited);

    db.cancelAwaiting(merchant.phone);
    const charge = db.createCharge({
      kind: 'push',
      merchantPhone: merchant.phone,
      merchantWaId: merchant.waId,
      payerPhone: parsed.phoneNumber,
      amountCents,
      concept: parsed.concept,
      status: 'awaiting_confirmation',
    });
    return reply(merchant.waId, texts.confirmPrompt(charge));
  }

  /** "sí" -> manda el push CoDi del cobro que estaba por confirmar. */
  async function confirm(merchant) {
    const charge = db.latestCharge(merchant.phone, ['awaiting_confirmation']);
    if (!charge) return reply(merchant.waId, texts.nothingToConfirm());

    if (now() - charge.createdAt > CONFIRMATION_WINDOW_MS) {
      db.transition(charge.id, 'awaiting_confirmation', 'cancelled');
      return reply(merchant.waId, texts.confirmationExpired());
    }
    // Los límites se revisan otra vez: entre el borrador y el "sí" pudieron salir otros cobros.
    const limited = demoLimit(merchant, { payerPhone: charge.payerPhone });
    if (limited) {
      db.transition(charge.id, 'awaiting_confirmation', 'cancelled');
      return reply(merchant.waId, limited);
    }
    // Si otro "sí" ya lo tomó, este no hace nada: nunca dos cobros por un mensaje repetido.
    if (!db.transition(charge.id, 'awaiting_confirmation', 'sending')) return undefined;

    const expiresAt = now() + MIN_EXPIRATION_SECONDS * 1000;
    try {
      const { transactionId, codiId } = await pey.createPush({
        amount: charge.amountCents / 100,
        phoneNumber: charge.payerPhone,
        concept: payerConcept(merchant.name, charge.concept),
        expiration: MIN_EXPIRATION_SECONDS,
        numRef: String(charge.id % 10_000_000),
        metadata: { chargeId: String(charge.id) },
      });
      db.updateCharge(charge.id, { status: 'pending', transactionId, codiId, expiresAt });
    } catch (error) {
      logPeyError(charge, 'el push', error);
      if (error.type === 'TIMEOUT' || error.type === 'NETWORK_ERROR') {
        // No se sabe si pey lo envió. Si se paga, el webhook lo liga por metadata.chargeId.
        db.updateCharge(charge.id, { status: 'unknown', expiresAt, error: error.message });
        return reply(merchant.waId, texts.sendUnknown(charge));
      }
      db.updateCharge(charge.id, { status: 'failed', error: `${error.type ?? ''} ${error.message}`.trim() });
      return reply(merchant.waId, texts.sendFailed(charge, peyErrorReason(error)));
    }
    return reply(merchant.waId, texts.sent(charge, MIN_EXPIRATION_SECONDS / 60));
  }

  async function cancel(merchant) {
    const charge = db.latestCharge(merchant.phone, ['awaiting_confirmation']);
    if (!charge) return reply(merchant.waId, texts.nothingToConfirm());
    db.transition(charge.id, 'awaiting_confirmation', 'cancelled');
    return reply(merchant.waId, texts.cancelled(charge));
  }

  /**
   * "liga 150 corte" o "qr 150 corte": cobros que no necesitan el teléfono del
   * cliente. No piden confirmación porque no le llegan a nadie: el comerciante
   * recibe la liga o el QR y decide a quién mostrarlo.
   */
  async function chargeWithoutPhone(merchant, text) {
    const parsed = parseAmountCommand(text);
    if (!parsed.ok) return reply(merchant.waId, parsed.error);
    if (parsed.kind === 'link' && !publicBaseUrl) return reply(merchant.waId, texts.linkUnavailable());

    const amountCents = toCents(parsed.amount);
    const limited = demoLimit(merchant, { amountCents });
    if (limited) return reply(merchant.waId, limited);

    const charge = db.createCharge({
      kind: parsed.kind,
      merchantPhone: merchant.phone,
      merchantWaId: merchant.waId,
      amountCents,
      concept: parsed.concept,
      status: 'creating',
    });
    return parsed.kind === 'qr' ? createQr(merchant, charge) : createDirectLink(merchant, charge);
  }

  async function createDirectLink(merchant, charge) {
    try {
      const { id, url } = await pey.createPaymentLink({
        amount: charge.amountCents / 100,
        successUrl: `${publicBaseUrl}/pago/gracias`,
        backUrl: `${publicBaseUrl}/pago/cancelado`,
        clientReferenceId: `cobro-${charge.id}`,
        metadata: { chargeId: String(charge.id) },
      });
      const updated = db.updateCharge(charge.id, { status: 'link', linkId: id, linkUrl: url });
      return reply(merchant.waId, texts.directLink(updated));
    } catch (error) {
      logPeyError(charge, 'la liga', error);
      db.updateCharge(charge.id, { status: 'failed', error: `${error.type ?? ''} ${error.message}`.trim() });
      return reply(merchant.waId, texts.directLinkFailed(charge, peyErrorReason(error)));
    }
  }

  async function createQr(merchant, charge) {
    let png;
    try {
      const qr = await pey.createQr({
        amount: charge.amountCents / 100,
        concept: payerConcept(merchant.name, charge.concept),
        expiration: QR_EXPIRATION_SECONDS,
        numRef: String(charge.id % 10_000_000),
        metadata: { chargeId: String(charge.id) },
      });
      // El qrString se codifica tal cual: pey pide no parsearlo ni reformatearlo.
      png = await renderQr(qr.qrString);
      db.updateCharge(charge.id, { status: 'qr', qrId: qr.id, expiresAt: now() + QR_EXPIRATION_SECONDS * 1000 });
    } catch (error) {
      logPeyError(charge, 'el QR', error);
      db.updateCharge(charge.id, { status: 'failed', error: `${error.type ?? ''} ${error.message}`.trim() });
      return reply(merchant.waId, texts.qrFailed(charge, peyErrorReason(error)));
    }
    return outbox.sendImage(merchant.waId, { png, caption: texts.qrCaption(charge, QR_EXPIRATION_SECONDS / 60) });
  }

  /** "liga" sola -> plan B: liga de pago para el último push que expiró. */
  async function sendLinkForExpired(merchant) {
    if (!publicBaseUrl) return reply(merchant.waId, texts.linkUnavailable());

    const charge = db.latestCharge(merchant.phone, ['expired']);
    if (!charge || charge.kind !== 'push' || now() - charge.createdAt > LINK_WINDOW_MS) {
      return reply(merchant.waId, texts.noExpiredCharge());
    }
    if (!db.transition(charge.id, 'expired', 'link_creating')) return undefined;

    try {
      const { id, url } = await pey.createPaymentLink({
        amount: charge.amountCents / 100,
        successUrl: `${publicBaseUrl}/pago/gracias`,
        backUrl: `${publicBaseUrl}/pago/cancelado`,
        clientReferenceId: `cobro-${charge.id}`,
        metadata: { chargeId: String(charge.id) },
      });
      const updated = db.updateCharge(charge.id, { status: 'link', linkId: id, linkUrl: url });
      return reply(merchant.waId, texts.link(updated));
    } catch (error) {
      logPeyError(charge, 'la liga', error);
      db.transition(charge.id, 'link_creating', 'expired');
      return reply(merchant.waId, texts.linkFailed(charge));
    }
  }

  async function summary(merchant) {
    const today = dayKey(now());
    const charges = db
      .listSince(merchant.phone, now() - 36 * 60 * 60 * 1000)
      .filter((charge) => dayKey(charge.createdAt) === today);
    return reply(
      merchant.waId,
      texts.summary({
        paid: charges.filter((c) => c.status === 'paid'),
        pending: charges.filter((c) => ['pending', 'unknown', 'link', 'qr'].includes(c.status)),
        expiredCount: charges.filter((c) => c.status === 'expired').length,
      }),
    );
  }

  /**
   * Avisa "Pagado" al comerciante. Si el envío falla lanza el error y el cobro
   * queda sin `notifiedAt`, para que `sweep` lo vuelva a intentar.
   */
  async function notifyPaid(charge) {
    if (charge.notifiedAt) return;
    if (charge.merchantWaId) await reply(charge.merchantWaId, texts.paid(charge));
    else log.info(`[bot] pagado el cobro ${charge.id} (sin comerciante a quien avisar)`);
    db.updateCharge(charge.id, { notifiedAt: now() });
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

  /**
   * Tarea periódica:
   *  - marca como expirados los push y QR cuyo plazo venció, confirmando antes
   *    con la API que de verdad no se pagaron;
   *  - reintenta los avisos de "Pagado" que no se pudieron entregar.
   */
  async function sweep() {
    for (const charge of db.listDue(now() - EXPIRATION_GRACE_MS)) {
      try {
        const tx = await findPayment(charge);
        if (tx) {
          db.markPaid(charge.id, {
            paidAt: tx.datePaid,
            trackingKey: tx.metadata?.trackingKey ?? null,
            paidVia: charge.kind,
            transactionId: tx.id ?? null,
          });
          await notifyPaid(db.getCharge(charge.id));
          continue;
        }
        if (!db.transition(charge.id, charge.status, 'expired')) continue;
        const canLink = charge.kind === 'push' && Boolean(publicBaseUrl);
        if (charge.merchantWaId) await reply(charge.merchantWaId, texts.expired(charge, canLink));
      } catch (error) {
        // Se queda como estaba; el siguiente barrido lo vuelve a intentar.
        log.error(`[bot] cobro ${charge.id}: no se pudo revisar la expiración: ${error.message}`);
      }
    }

    for (const charge of db.listPaidNotNotified()) {
      try {
        await notifyPaid(charge);
      } catch (error) {
        log.error(`[bot] cobro ${charge.id}: no se pudo avisar del pago: ${error.message}`);
      }
    }
  }

  function logPeyError(charge, what, error) {
    const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
    log.error(`[bot] cobro ${charge.id}: falló ${what} (${error.type ?? error.name}): ${error.message}${requestId}`);
  }

  return { handleMessage, notifyPaid, sweep };
}
