// Canal de chat: WhatsApp y la demo web pública. Traduce cada mensaje a una
// operación del núcleo de cobros (charges.js) y responde con texto.
//
// Un número de WhatsApp cobra a nombre del comerciante al que está ligado.
// Para ligarlo, el comerciante genera un código en la web (Ajustes) y manda
// "vincular <código>" desde su WhatsApp: así se comprueba que el número es suyo.

import { normalizePhone, parseAmountCommand, parseCommand } from './command.js';
import { texts } from './messages.js';
import { toCents } from './pey.js';

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

/**
 * @param demo Opcional: { merchantName }. Activa a quienes escriben desde
 *   "demo:<sesión>" (la demo web), siempre en modo prueba.
 * @param webUrl URL de la web, para decirle a un número sin cuenta dónde registrarse.
 */
export function createBot({ store, charges, outbox, demo = null, webUrl = null, log = console }) {
  const reply = (to, body) => (body ? outbox.sendText(to, body) : undefined);

  /** El contexto de cobro de quien escribe, o null si no puede cobrar. */
  async function contextFor(from) {
    if (demo && String(from).startsWith('demo:')) {
      return charges.contextFor(null, {
        channel: 'demo',
        notifyTo: from,
        demoSession: String(from).slice('demo:'.length),
        demoName: demo.merchantName,
      });
    }
    const phone = normalizePhone(from);
    const merchant = phone ? await store.getMerchantByWhatsapp(phone) : null;
    return merchant ? charges.contextFor(merchant, { channel: 'whatsapp', notifyTo: from }) : null;
  }

  async function handleMessage({ from, text }) {
    const simple = simplify(text);

    // "vincular 123456" funciona aunque el número todavía no tenga cuenta.
    const link = /^vincular (\d{6})$/.exec(simple);
    const phone = normalizePhone(from);
    if (link && phone) {
      const merchant = await store.linkWhatsapp(link[1], phone);
      return reply(from, merchant ? texts.linked(merchant) : texts.linkCodeInvalid());
    }

    const ctx = await contextFor(from);
    if (!ctx) return reply(from, texts.notRegistered(webUrl));
    if (text === null) return reply(from, texts.onlyText());

    if (YES.has(simple)) return reply(from, (await charges.confirmPush(ctx)).message);
    if (NO.has(simple)) return reply(from, (await charges.cancelPush(ctx)).message);
    if (simple === 'liga') return reply(from, (await charges.linkForExpired(ctx)).message);
    if (simple === 'resumen' || simple === 'pendientes') return reply(from, texts.summary(await charges.summary(ctx)));
    if (HELP.has(simple)) return reply(from, texts.help());
    if (/^cobra/.test(simple)) return draft(ctx, from, text);
    if (/^(liga|qr)( |$)/.test(simple)) return withoutPhone(ctx, from, text);
    return reply(from, texts.notUnderstood());
  }

  async function draft(ctx, from, text) {
    const parsed = parseCommand(text);
    if (!parsed.ok) return reply(from, parsed.error);
    const result = await charges.draftPush(ctx, {
      amountCents: toCents(parsed.amount),
      payerPhone: parsed.phoneNumber,
      concept: parsed.concept,
    });
    return reply(from, result.message);
  }

  /** "liga 150 corte" o "qr 150 corte": no piden confirmación porque no le llegan a nadie. */
  async function withoutPhone(ctx, from, text) {
    const parsed = parseAmountCommand(text);
    if (!parsed.ok) return reply(from, parsed.error);
    const input = { amountCents: toCents(parsed.amount), concept: parsed.concept };
    if (parsed.kind === 'link') return reply(from, (await charges.createLink(ctx, input)).message);

    const result = await charges.createQr(ctx, input);
    if (!result.ok) return reply(from, result.message);
    return outbox.sendImage(from, { png: result.png, caption: result.message });
  }

  return { handleMessage, log };
}
