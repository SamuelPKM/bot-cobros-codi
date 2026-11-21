'use client';

import { useActionState, useState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { primaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { createCharge, type NewChargeState } from '../actions/create-charge.action';
import type { ChargeMethod } from '../types/charge.types';

const METHODS: { value: ChargeMethod; label: string; hint: string }[] = [
  { value: 'push', label: 'Push al celular', hint: 'Le llega la solicitud a la app de su banco.' },
  { value: 'qr', label: 'QR', hint: 'Tu cliente lo escanea con la app de su banco.' },
  { value: 'link', label: 'Liga de pago', hint: 'Se la mandas por donde quieras. Acepta CoDi y tarjeta.' },
];

const initialState: NewChargeState = {};

export function NewChargeForm() {
  const [state, formAction, pending] = useActionState(createCharge, initialState);
  const [method, setMethod] = useState<ChargeMethod>('push');
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormAlert message={state.formError} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-zinc-800">¿Cómo cobras?</legend>
        {METHODS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 ${
              method === option.value ? 'border-emerald-700 bg-emerald-50' : 'border-zinc-300'
            }`}
          >
            <input
              type="radio"
              name="method"
              value={option.value}
              // No controlado: React reinicia el formulario tras la acción y vuelve
              // a este valor, que es el que se envió.
              defaultChecked={(values.method ?? 'push') === option.value}
              onChange={() => setMethod(option.value)}
              className="mt-1 accent-emerald-700"
            />
            <span className="flex flex-col">
              <span className="font-medium text-zinc-900">{option.label}</span>
              <span className="text-sm text-zinc-600">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {method === 'push' && (
        <TextField
          label="Celular del cliente"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="55 1234 5678"
          defaultValue={values.phone}
          error={state.fieldErrors?.phone}
          required
        />
      )}
      <TextField
        label="Monto (pesos)"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="150.00"
        defaultValue={values.amount}
        error={state.fieldErrors?.amount}
        required
      />
      <TextField
        label="Concepto (opcional)"
        name="concept"
        maxLength={40}
        placeholder="Corte de pelo"
        defaultValue={values.concept}
        error={state.fieldErrors?.concept}
      />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? 'Cobrando…' : 'Cobrar'}
      </button>
    </form>
  );
}
