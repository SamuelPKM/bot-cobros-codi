'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormNotice } from '@/shared/ui/form-notice';
import { primaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { createSeller, type NewSellerState } from '../actions/members.action';

const initialState: NewSellerState = {};

/** Alta directa de un vendedor (alternativa a la invitación). */
export function NewSellerForm() {
  const [state, formAction, pending] = useActionState(createSeller, initialState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2 flex flex-col gap-2">
        <FormAlert message={state.formError} />
        <FormNotice message={state.notice} />
      </div>
      <TextField label="Nombre" name="name" maxLength={80} defaultValue={values.name} error={errors.name} required />
      <TextField
        label="Usuario"
        name="username"
        autoComplete="off"
        maxLength={30}
        defaultValue={values.username}
        error={errors.username}
        required
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        required
      />
      <TextField
        label="Tope por cobro (opcional, pesos)"
        name="maxAmount"
        inputMode="decimal"
        defaultValue={values.maxAmount}
        error={errors.maxAmount}
      />
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? 'Dando de alta…' : 'Dar de alta'}
        </button>
      </div>
    </form>
  );
}
