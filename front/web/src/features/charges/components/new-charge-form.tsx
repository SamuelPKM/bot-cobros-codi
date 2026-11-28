'use client';

import { useActionState, useState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { primaryButton } from '@/shared/ui/styles';
import { formatMoney } from '@/shared/format/format';
import { TextField } from '@/shared/ui/text-field';
import { createCharge, type NewChargeState } from '../actions/create-charge.action';
import { tipPreview, type TipOption } from '../policies/new-charge-form.policy';
import type { ChargeMethod } from '../types/charge.types';

const METHODS: { value: ChargeMethod; label: string; hint: string }[] = [
  { value: 'push', label: 'Push al celular', hint: 'Le llega la solicitud a la app de su banco.' },
  { value: 'qr', label: 'QR', hint: 'Tu cliente lo escanea con la app de su banco.' },
  { value: 'link', label: 'Liga de pago', hint: 'Se la mandas por donde quieras. Acepta CoDi y tarjeta.' },
];

const TIP_OPTIONS: { value: TipOption; label: string }[] = [
  { value: 'none', label: 'Sin propina' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
  { value: 'custom', label: 'Otra' },
];

const initialState: NewChargeState = {};

export function NewChargeForm() {
  const [state, formAction, pending] = useActionState(createCharge, initialState);
  const [method, setMethod] = useState<ChargeMethod>('push');
  const values = state.values ?? {};
  const [amountText, setAmountText] = useState('');
  const [tipOption, setTipOption] = useState<TipOption>('none');
  const [tipText, setTipText] = useState('');
  const preview = tipPreview(amountText, tipOption, tipText);

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
        onChange={(event) => setAmountText(event.target.value)}
        error={state.fieldErrors?.amount}
        required
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-zinc-800">Propina</legend>
        <div
          role="radiogroup"
          aria-label="Propina"
          className="inline-flex flex-wrap self-start rounded-lg bg-zinc-100 p-1 text-sm"
        >
          {TIP_OPTIONS.map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="tipOption"
                value={option.value}
                defaultChecked={(values.tipOption || 'none') === option.value}
                onChange={() => setTipOption(option.value)}
                className="peer sr-only"
              />
              <span
                className={`block rounded-md px-3 py-1.5 font-medium transition peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 ${
                  tipOption === option.value
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {tipOption === 'custom' && (
        <TextField
          label="Propina (pesos)"
          name="tip"
          inputMode="decimal"
          autoComplete="off"
          placeholder="10.00"
          defaultValue={values.tip}
          onChange={(event) => setTipText(event.target.value)}
          error={state.fieldErrors?.tip}
        />
      )}
      {state.fieldErrors?.tip && tipOption !== 'custom' && (
        <p className="text-sm text-red-700">{state.fieldErrors.tip}</p>
      )}
      <div aria-live="polite" className="flex flex-col">
        {preview && (
          <>
            <span className="font-semibold text-zinc-900">
              Total a cobrar: {formatMoney(preview.total)}
            </span>
            {preview.tip > 0 && (
              <span className="text-sm text-zinc-600">
                Cobro {formatMoney(preview.subtotal)} + propina {formatMoney(preview.tip)}
              </span>
            )}
          </>
        )}
      </div>
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
