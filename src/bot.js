// Lógica del bot: qué hacer con cada mensaje del comerciante y con cada pago.
//
// No sabe nada de HTTP: recibe la base de datos, el cliente de pey y el de
// WhatsApp, así que se puede probar completo con dobles.

import { normalizePhone, parseCommand } from './command.js';
import { payerConcept, peyErrorReason, texts } from './messages.js';
import { MIN_EXPIRATION_SECONDS, toCents } from './pey.js';

const CONFIRMATION_WINDOW_MS = 10 * 60 * 1000; // tiempo para responder "sí"
const LINK_WINDOW_MS = 24 * 60 * 60 * 1000; // tiempo para pedir la liga de un cobro expirado
const EXPIRATION_GRACE_MS = 20 * 1000; // margen por si el webhook de pago viene en camino
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

/**
 * @param merchants Map de teléfono (10 dígitos) -> nombre del negocio. Solo
 *   estos números pueden mandar cobros.
 * @param publicBaseUrl URL pública HTTPS del servidor; hace falta para las ligas.
 */
export function createBot({ db, pey, whatsapp, merchants, publicBaseUrl = null, now = Date.now, log = console }) {
  async function reply(waId, body) {
    await whatsapp.sendText(waId, body);
  }

  async function handleMessage({ from, text }) {
    const merchantPhone = normalizePhone(from);
    const merchantName = merchantPhone ? merchants.get(merchantPhone) : undefined;
    if (!merchantName) return reply(from, texts.notRegistered());
    if (text === null) return reply(from, texts.onlyText());

    const merchant = { phone: merchantPhone, waId: from, name: merchantName };
    const simple = simplify(text);

    if (YES.has(simple)) return confirm(merchant);
    if (NO.has(simple)) return cancel(merchant);
    if (simple === 'liga') return sendLink(merchant);
    if (simple === 'resumen' || simple === 'pendientes') return summary(merchant);
    if (HELP.has(simple)) return reply(from, texts.help());
    if (/^cobra/.test(simple)) return draft(merchant, text);
    return reply(from, texts.notUnderstood());
  }

  /** "cobra 150 a 55..." -> guarda el cobro y pide confirmación. Todavía no cobra nada. */
  async function draft(merchant, text) {
    const parsed = parseCommand(text);
    if (!parsed.ok) return reply(merchant.waId, parsed.error);

    db.cancelAwaiting(merchant.phone);
    const charge = db.createCharge({
      merchantPhone: merchant.phone,
      merchantWaId: merchant.waId,
      payerPhone: parsed.phoneNumber,
      amountCents: toCents(parsed.amount),
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
      const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
      log.error(`[bot] cobro ${charge.id}: falló el push (${error.type ?? error.name}): ${error.message}${requestId}`);

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

  /** "liga" -> plan B: liga de pago para el último cobro que expiró. */
  async function sendLink(merchant) {
    if (!publicBaseUrl) return reply(merchant.waId, texts.linkUnavailable());

    const charge = db.latestCharge(merchant.phone, ['expired']);
    if (!charge || now() - charge.createdAt > LINK_WINDOW_MS) {
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
      const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
      log.error(`[bot] cobro ${charge.id}: falló la liga (${error.type ?? error.name}): ${error.message}${requestId}`);
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
        pending: charges.filter((c) => ['pending', 'unknown', 'link'].includes(c.status)),
        expiredCount: charges.filter((c) => c.status === 'expired').length,
      }),
    );
  }

  /**
   * Avisa "Pagado" al comerciante. Si WhatsApp falla lanza el error y el cobro
   * queda sin `notifiedAt`, para que `sweep` lo vuelva a intentar.
   */
  async function notifyPaid(charge) {
    if (charge.notifiedAt) return;
    if (charge.merchantWaId) await reply(charge.merchantWaId, texts.paid(charge));
    else log.info(`[bot] pagado el cobro ${charge.id} (sin comerciante a quien avisar)`);
    db.updateCharge(charge.id, { notifiedAt: now() });
  }

  /**
   * Tarea periódica:
   *  - marca como expirados los cobros cuyo plazo venció, confirmando antes
   *    con la API que de verdad no se pagaron;
   *  - reintenta los avisos de "Pagado" que no se pudieron entregar.
   */
  async function sweep() {
    for (const charge of db.listDue(now() - EXPIRATION_GRACE_MS)) {
      try {
        if (charge.transactionId) {
          const tx = await pey.getTransaction(charge.transactionId);
          if (tx.status === 'PAID') {
            db.markPaid(charge.id, {
              paidAt: tx.datePaid,
              trackingKey: tx.metadata?.trackingKey ?? null,
              paidVia: 'push',
            });
            await notifyPaid(db.getCharge(charge.id));
            continue;
          }
        }
        if (!db.transition(charge.id, charge.status, 'expired')) continue;
        if (charge.merchantWaId) await reply(charge.merchantWaId, texts.expired(charge, Boolean(publicBaseUrl)));
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

  return { handleMessage, notifyPaid, sweep };
}
