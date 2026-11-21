import { field, type Parsed } from '@/shared/forms/form-state.type';
import type { ChargeMethod } from '../types/charge.types';

export type NewChargeField = 'method' | 'phone' | 'amount' | 'concept';

/** Cuerpo de POST /charges. */
export interface NewChargeInput {
  method: ChargeMethod;
  phone?: string;
  amount: number;
  concept?: string;
}

const MAX_AMOUNT = 1_000_000;
const METHODS: readonly ChargeMethod[] = ['push', 'qr', 'link'];

/** Celular a 10 dígitos; acepta espacios, guiones y la lada +52. */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  return null;
}

/** Mismas reglas que CreateChargeDto de la API. */
export function parseNewChargeForm(form: FormData): Parsed<NewChargeField, NewChargeInput> {
  const rawMethod = field(form, 'method');
  const method = (METHODS as readonly string[]).includes(rawMethod)
    ? (rawMethod as ChargeMethod)
    : 'push';
  const errors: Partial<Record<NewChargeField, string>> = {};

  let phone: string | undefined;
  if (method === 'push') {
    phone = normalizePhone(field(form, 'phone')) ?? undefined;
    if (!phone) errors.phone = 'El celular debe tener 10 dígitos';
  }

  const rawAmount = field(form, 'amount').replace(/[$,\s]/g, '');
  const amount = Number(rawAmount);
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount))
    errors.amount = 'Escribe el monto en pesos, con máximo 2 decimales';
  else if (amount <= 0) errors.amount = 'El monto debe ser mayor a 0';
  else if (amount > MAX_AMOUNT) errors.amount = 'El monto máximo por cobro es de $1,000,000';

  const concept = field(form, 'concept');
  if (concept.length > 40) errors.concept = 'El concepto admite máximo 40 caracteres';

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: {
      method,
      ...(phone ? { phone } : {}),
      amount,
      ...(concept ? { concept } : {}),
    },
  };
}
