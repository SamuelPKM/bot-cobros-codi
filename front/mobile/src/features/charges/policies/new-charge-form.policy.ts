import type { ChargeMethod } from '../types/charge.types';

export type NewChargeField = 'phone' | 'amount' | 'concept';

export interface NewChargeValues {
  method: ChargeMethod;
  phone: string;
  amount: string;
  concept: string;
}

/** Cuerpo de POST /charges. */
export interface NewChargeInput {
  method: ChargeMethod;
  phone?: string;
  amount: number;
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
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount))
    errors.amount = 'Escribe el monto en pesos, con máximo 2 decimales';
  else if (amount <= 0) errors.amount = 'El monto debe ser mayor a 0';
  else if (amount > MAX_AMOUNT) errors.amount = 'El monto máximo por cobro es de $1,000,000';

  const concept = values.concept.trim();
  if (concept.length > 40) errors.concept = 'El concepto admite máximo 40 caracteres';

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: { method, ...(phone ? { phone } : {}), amount, ...(concept ? { concept } : {}) },
  };
}
