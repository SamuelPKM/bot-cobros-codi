'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { primaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { acceptInvitation, type AcceptState } from '../actions/accept-invitation.action';

const initialState: AcceptState = {};

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvitation.bind(null, token), initialState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert message={state.formError} />
      <TextField
        label="Tu nombre"
        name="name"
        autoComplete="name"
        maxLength={80}
        defaultValue={values.name}
        error={errors.name}
        required
      />
      <TextField
        label="Usuario"
        name="username"
        autoComplete="username"
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
        minLength={8}
        maxLength={200}
        error={errors.password}
        required
      />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? 'Creando cuenta…' : 'Unirme al equipo'}
      </button>
    </form>
  );
}
