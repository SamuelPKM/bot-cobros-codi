// Interpreta lo que escribe una persona del equipo (WhatsApp o la demo):
//
//   cobra 150 a 5512345678 corte de pelo    -> cobro push (pide confirmar con "sí")
//   qr 150 corte de pelo · liga 150 corte   -> QR o liga, sin teléfono
//   liga                                    -> liga del último cobro pendiente
//   sí · no · resumen · ayuda · vincular 123456
//
// Es una función pura: no sabe de canales, base de datos ni pey.

import { pesosToCents } from '../../../shared/money/money';
import { MAX_AMOUNT } from '../../pey/constants/pey.constants';

export type Command =
  | {
      type: 'charge';
      amountCents: number;
      payerPhone: string;
      concept: string | null;
    }
  | { type: 'qr' | 'link'; amountCents: number; concept: string | null }
  | { type: 'link-last' }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'summary' }
  | { type: 'help' }
  | { type: 'link-account'; code: string }
  | { type: 'invalid'; error: string }
  | { type: 'unknown' };

export const CHARGE_EXAMPLE = 'cobra 150 a 5512345678 corte de pelo';

const YES = new Set([
  'si',
  's',
  'ok',
  'va',
  'dale',
  'confirmar',
  'confirmo',
  'enviar',
]);
const NO = new Set(['no', 'n', 'cancelar', 'cancela']);
const HELP = new Set([
  'ayuda',
  'hola',
  'menu',
  'help',
  'buenas',
  'buenos dias',
  'buenas tardes',
]);
const SUMMARY = new Set(['resumen', 'pendientes']);

const CHARGE =
  /^\s*c[oó]bra(?:r|le)?\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:pesos|mxn)?\s+al?\s+(.+?)\s*$/is;
const WITHOUT_PHONE =
  /^\s*(liga|qr)\s+(?:de\s+)?\$?\s*([\d,]+(?:\.\d+)?)\s*(?:pesos|mxn)?(?:\s+(?:por\s+)?(.*?))?\s*$/is;
const PHONE_TOKEN = /^[+\d().-]+$/;
const AMOUNT = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;

/** Minúsculas, sin acentos ni signos: "¡Sí!" -> "si". */
function simplify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deja un celular mexicano en 10 dígitos. Acepta espacios, guiones,
 * paréntesis y los prefijos +52 y +52 1 (como WhatsApp entrega los números).
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('521')) return digits.slice(3);
  return null;
}

function parseAmount(
  text: string,
): { amountCents: number } | { error: string } {
  if (!AMOUNT.test(text)) {
    return {
      error: `No entendí el monto "${text}". Usa números con máximo 2 decimales, como 150 o 150.50`,
    };
  }
  const amount = Number(text.replace(/,/g, ''));
  if (amount <= 0) return { error: 'El monto debe ser mayor a 0' };
  if (amount > MAX_AMOUNT)
    return { error: 'El monto máximo por cobro es de $1,000,000' };
  return { amountCents: pesosToCents(amount) };
}

function parseCharge(text: string): Command {
  const match = CHARGE.exec(text);
  if (!match)
    return {
      type: 'invalid',
      error: `No entendí el cobro. Escribe, por ejemplo: ${CHARGE_EXAMPLE}`,
    };
  const [, amountText, rest] = match;
  const amount = parseAmount(amountText);
  if ('error' in amount) return { type: 'invalid', error: amount.error };

  // El teléfono puede venir en partes ("55 1234 5678") y el concepto empezar
  // con un número ("2 cortes"): se prueba con todas las partes que parecen
  // teléfono y se van quitando hasta que el número sea válido.
  const tokens = rest.split(/\s+/);
  let phoneTokens = 0;
  while (phoneTokens < tokens.length && PHONE_TOKEN.test(tokens[phoneTokens]))
    phoneTokens += 1;
  for (let n = phoneTokens; n >= 1; n -= 1) {
    const payerPhone = normalizePhone(tokens.slice(0, n).join(''));
    if (payerPhone) {
      return {
        type: 'charge',
        amountCents: amount.amountCents,
        payerPhone,
        concept: tokens.slice(n).join(' ') || null,
      };
    }
  }
  return {
    type: 'invalid',
    error: `El celular debe tener 10 dígitos. Ejemplo: ${CHARGE_EXAMPLE}`,
  };
}

function parseWithoutPhone(text: string, keyword: 'qr' | 'liga'): Command {
  const example = `${keyword} 150 corte de pelo`;
  const match = WITHOUT_PHONE.exec(text);
  if (!match)
    return {
      type: 'invalid',
      error: `Escribe el monto después de "${keyword}". Ejemplo: ${example}`,
    };
  const [, , amountText, concept] = match;
  const amount = parseAmount(amountText);
  if ('error' in amount) return { type: 'invalid', error: amount.error };
  return {
    type: keyword === 'qr' ? 'qr' : 'link',
    amountCents: amount.amountCents,
    concept: concept || null,
  };
}

export function parseMessage(text: string): Command {
  const simple = simplify(text);

  const link = /^vincular (\d{6})$/.exec(simple);
  if (link) return { type: 'link-account', code: link[1] };
  if (YES.has(simple)) return { type: 'confirm' };
  if (NO.has(simple)) return { type: 'cancel' };
  if (SUMMARY.has(simple)) return { type: 'summary' };
  if (HELP.has(simple)) return { type: 'help' };
  if (simple === 'liga') return { type: 'link-last' };
  if (/^cobra/.test(simple)) return parseCharge(text);
  const keyword = /^(liga|qr)( |$)/.exec(simple)?.[1] as
    'qr' | 'liga' | undefined;
  if (keyword) return parseWithoutPhone(text, keyword);
  return { type: 'unknown' };
}
