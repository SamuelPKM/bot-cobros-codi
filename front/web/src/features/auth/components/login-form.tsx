'use client';

import { useActionState } from 'react';
import { primaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { login } from '../actions/login.action';
import type { LoginState } from '../types/login-state.type';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {state.formError}
        </p>
      )}
      <TextField
        label="Usuario"
        name="username"
        autoComplete="username"
        defaultValue={state.username}
        error={state.fieldErrors?.username}
        maxLength={30}
        required
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        maxLength={200}
        required
      />
      <button
        type="submit"
        disabled={pending}
        className={`mt-1 ${primaryButton}`}
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
