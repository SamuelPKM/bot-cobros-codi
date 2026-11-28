import { field, type Parsed } from '@/shared/forms/form-state.type';
import type { ChargeMethod } from '../types/charge.types';

export type NewChargeField = 'method' | 'phone' | 'amount' | 'tipOption' | 'tip' | 'concept';

export type TipOption = 'none' | '10' | '15' | '20' | 'custom';

/** Cuerpo de POST /charges. */
export interface NewChargeInput {
  method: ChargeMethod;
  phone?: string;
  /** Cobro sin propina, en pesos. */
  amount: number;
  /** Propina en pesos; solo si es mayor a 0. */
  tip?: number;
  concept?: string;
}

const MAX_AMOUNT = 1_000_000;
const METHODS: readonly ChargeMethod[] = ['push', 'qr', 'link'];
const TIP_OPTIONS: readonly TipOption[] = ['none', '10', '15', '20', 'custom'];
const TIP_FORMAT_ERROR = 'Escribe la propina en pesos, con máximo 2 decimales';

/** Celular a 10 dígitos; acepta espacios, guiones y la lada +52. */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  return null;
}

const cleanMoney = (text: string) => text.replace(/[$,\s]/g, '');

const parseTipOption = (raw: string): TipOption =>
  (TIP_OPTIONS as readonly string[]).includes(raw) ? (raw as TipOption) : 'none';

/**
 * Propina en centavos enteros (sin errores de flotantes) o el mensaje de error.
 * Mismas reglas que la API: no mayor que el cobro y total de hasta $1,000,000.
 */
function tipCents(amountCents: number, option: TipOption, tipText: string): number | string {
  if (option === 'none') return 0;
  let tip: number;
  if (option === 'custom') {
    const raw = cleanMoney(tipText);
    if (/^-\d+(\.\d+)?$/.test(raw)) return 'La propina no puede ser negativa';
    if (/^\d+\.\d{3,}$/.test(raw)) return 'La propina admite máximo 2 decimales';
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return TIP_FORMAT_ERROR;
    tip = Math.round(Number(raw) * 100);
  } else {
    tip = Math.round((amountCents * Number(option)) / 100);
  }
  if (tip > amountCents) return 'La propina no puede ser mayor que el cobro';
  if (amountCents + tip > MAX_AMOUNT * 100) return 'El total con propina no puede pasar de $1,000,000';
  return tip;
}

export interface TipPreview {
  subtotal: number;
  tip: number;
  total: number;
}

/** Cobro, propina y total para mostrar en vivo; null si el monto aún no es válido. */
export function tipPreview(amountText: string, tipOption: string, tipText: string): TipPreview | null {
  const raw = cleanMoney(amountText);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const amountCents = Math.round(Number(raw) * 100);
  if (amountCents <= 0) return null;
  const result = tipCents(amountCents, parseTipOption(tipOption), tipText);
  const tip = typeof result === 'number' ? result : 0;
  return { subtotal: amountCents / 100, tip: tip / 100, total: (amountCents + tip) / 100 };
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

  const rawAmount = cleanMoney(field(form, 'amount'));
  const amount = Number(rawAmount);
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount))
    errors.amount = 'Escribe el monto en pesos, con máximo 2 decimales';
  else if (amount <= 0) errors.amount = 'El monto debe ser mayor a 0';
  else if (amount > MAX_AMOUNT) errors.amount = 'El monto máximo por cobro es de $1,000,000';

  let tip = 0;
  if (!errors.amount) {
    const result = tipCents(
      Math.round(amount * 100),
      parseTipOption(field(form, 'tipOption')),
      field(form, 'tip'),
    );
    if (typeof result === 'string') errors.tip = result;
    else tip = result / 100;
  }

  const concept = field(form, 'concept');
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
