// Interpreta el mensaje del comerciante: "cobra <monto> a <teléfono> <concepto>".
//
//   cobra 150 a 5512345678 corte de pelo
//   Cobra $1,500.50 al +52 55 1234 5678 anticipo
//   cobrar 80 pesos a 5215512345678

const MAX_AMOUNT = 1_000_000;
const COMMAND = /^\s*c[oó]bra(?:r|le)?\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:pesos|mxn)?\s+al?\s+(.+?)\s*$/is;
const PHONE_TOKEN = /^[+\d().-]+$/;

export const HELP =
  'Escribe: cobra <monto> a <teléfono de 10 dígitos> <concepto>. Ejemplo: cobra 150 a 5512345678 corte de pelo';

/**
 * Deja un teléfono mexicano en 10 dígitos, como lo pide pey.
 * Acepta espacios, guiones y paréntesis, y los prefijos +52 y +52 1 (el
 * formato en que WhatsApp entrega los números). Devuelve null si no es válido.
 */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('521')) return digits.slice(3);
  return null;
}

/** Valida el texto de un monto. Devuelve { amount } o { error }. */
function parseAmount(amountText) {
  if (!/^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(amountText)) {
    return { error: `No entendí el monto "${amountText}". Usa números con máximo 2 decimales, como 150 o 150.50` };
  }
  const amount = Number(amountText.replace(/,/g, ''));
  if (amount <= 0) return { error: 'El monto debe ser mayor a 0' };
  if (amount > MAX_AMOUNT) return { error: 'El monto máximo por cobro es de $1,000,000' };
  return { amount };
}

const AMOUNT_COMMAND = /^\s*(liga|qr)\s+(?:de\s+)?\$?\s*([\d,]+(?:\.\d+)?)\s*(?:pesos|mxn)?(?:\s+(?:por\s+)?(.*?))?\s*$/is;

/**
 * Cobros sin teléfono: "liga 150 corte de pelo" o "qr 150 corte de pelo".
 * Devuelve { ok: true, kind: 'link' | 'qr', amount, concept } o { ok: false, error }.
 */
export function parseAmountCommand(text) {
  const keyword = /^\s*(liga|qr)\b/i.exec(String(text ?? ''))?.[1]?.toLowerCase();
  const example = keyword === 'qr' ? 'qr 150 corte de pelo' : 'liga 150 corte de pelo';
  const match = AMOUNT_COMMAND.exec(String(text ?? ''));
  if (!match) return { ok: false, error: `Escribe el monto después de "${keyword ?? 'liga'}". Ejemplo: ${example}` };

  const [, word, amountText, concept] = match;
  const parsed = parseAmount(amountText);
  if (parsed.error) return { ok: false, error: parsed.error };
  return { ok: true, kind: word.toLowerCase() === 'qr' ? 'qr' : 'link', amount: parsed.amount, concept: concept || null };
}

/**
 * Devuelve { ok: true, amount, phoneNumber, concept } o { ok: false, error }.
 * `error` es un texto listo para responderle al comerciante.
 */
export function parseCommand(text) {
  const match = COMMAND.exec(String(text ?? ''));
  if (!match) return { ok: false, error: `No entendí el mensaje. ${HELP}` };

  const [, amountText, rest] = match;

  const parsed = parseAmount(amountText);
  if (parsed.error) return { ok: false, error: parsed.error };
  const { amount } = parsed;

  // El teléfono puede venir en varias partes ("55 1234 5678") y el concepto
  // puede empezar con un número ("2 cortes"): se prueba primero con todas las
  // partes que parecen teléfono y se van quitando hasta que el número sea válido.
  const tokens = rest.split(/\s+/);
  let phoneTokens = 0;
  while (phoneTokens < tokens.length && PHONE_TOKEN.test(tokens[phoneTokens])) phoneTokens += 1;

  for (let n = phoneTokens; n >= 1; n -= 1) {
    const phoneNumber = normalizePhone(tokens.slice(0, n).join(''));
    if (phoneNumber) {
      const concept = tokens.slice(n).join(' ');
      return { ok: true, amount, phoneNumber, concept: concept || null };
    }
  }

  return { ok: false, error: 'El teléfono debe tener 10 dígitos. Ejemplo: cobra 150 a 5512345678 corte de pelo' };
}
