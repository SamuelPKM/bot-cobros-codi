import type { ChargeMethod } from '../types/charge.types';

export type NewChargeField = 'phone' | 'amount' | 'concept' | 'tip';

export type TipOption = 'none' | '10' | '15' | '20' | 'custom';

export interface NewChargeValues {
  method: ChargeMethod;
  phone: string;
  amount: string;
  concept: string;
  tipOption: TipOption;
  /** Pesos; solo se usa con la opción 'custom'. */
  tip: string;
}

/** Cuerpo de POST /charges. */
export interface NewChargeInput {
  method: ChargeMethod;
  phone?: string;
  /** Cobro sin propina. */
  amount: number;
  tip?: number;
  concept?: string;
}

export type ParsedNewCharge =
  | { ok: true; data: NewChargeInput }
  | { ok: false; fieldErrors: Partial<Record<NewChargeField, string>> };

const MAX_AMOUNT = 1_000_000;

/** Celular a 10 dígitos; acepta espacios, guiones y la lada +52. */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  return null;
}

/** "$1,500.5" → "1500.5"; "12,5" (coma decimal del teclado) → "12.5". */
function normalizeAmount(input: string): string {
  const cleaned = input.replace(/[$\s]/g, '');
  if (/^\d+,\d{1,2}$/.test(cleaned)) return cleaned.replace(',', '.');
  return cleaned.replace(/,/g, '');
}

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Pesos "12.50" → centavos enteros (sin errores de coma flotante). */
const toCents = (raw: string): number => Math.round(Number(raw) * 100);

/** Monto válido del cobro en centavos, o null. */
function amountCents(values: NewChargeValues): number | null {
  const raw = normalizeAmount(values.amount);
  if (!MONEY.test(raw)) return null;
  const cents = toCents(raw);
  return cents > 0 && cents <= MAX_AMOUNT * 100 ? cents : null;
}

type TipResult = { cents: number } | { error: string };

function tipCents(values: NewChargeValues, amount: number): TipResult {
  const { tipOption } = values;
  if (tipOption === 'none') return { cents: 0 };
  if (tipOption !== 'custom') return { cents: Math.round((amount * Number(tipOption)) / 100) };
  const raw = normalizeAmount(values.tip);
  if (/^-\d/.test(raw)) return { error: 'La propina no puede ser negativa' };
  if (!MONEY.test(raw)) return { error: 'Escribe la propina en pesos, con máximo 2 decimales' };
  return { cents: toCents(raw) };
}

/** Lo que se ve en vivo: cobro, propina y total en pesos. Null si el monto no es válido. */
export function tipPreview(values: NewChargeValues): { subtotal: number; tip: number; total: number } | null {
  const amount = amountCents(values);
  if (amount === null) return null;
  const tip = tipCents(values, amount);
  const cents = 'cents' in tip ? tip.cents : 0;
  return { subtotal: amount / 100, tip: cents / 100, total: (amount + cents) / 100 };
}

/** Mismas reglas que CreateChargeDto de la API. */
export function parseNewChargeForm(values: NewChargeValues): ParsedNewCharge {
  const { method } = values;
  const errors: Partial<Record<NewChargeField, string>> = {};

  let phone: string | undefined;
  if (method === 'push') {
    phone = normalizePhone(values.phone) ?? undefined;
    if (!phone) errors.phone = 'El celular debe tener 10 dígitos';
  }

  const rawAmount = normalizeAmount(values.amount);
  const amount = Number(rawAmount);
  if (!MONEY.test(rawAmount)) errors.amount = 'Escribe el monto en pesos, con máximo 2 decimales';
  else if (amount <= 0) errors.amount = 'El monto debe ser mayor a 0';
  else if (amount > MAX_AMOUNT) errors.amount = 'El monto máximo por cobro es de $1,000,000';

  let tip = 0;
  const cobro = amountCents(values);
  if (cobro !== null) {
    const result = tipCents(values, cobro);
    if ('error' in result) errors.tip = result.error;
    else if (result.cents > cobro) errors.tip = 'La propina no puede ser mayor que el cobro';
    else if (cobro + result.cents > MAX_AMOUNT * 100)
      errors.tip = 'El total con propina no puede pasar de $1,000,000';
    else tip = result.cents / 100;
  }

  const concept = values.concept.trim();
  if (concept.length > 40) errors.concept = 'El concepto admite máximo 40 caracteres';

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: {
      method,
      ...(phone ? { phone } : {}),
      amount,
      ...(tip > 0 ? { tip } : {}),
      ...(concept ? { concept } : {}),
    },
  };
}
