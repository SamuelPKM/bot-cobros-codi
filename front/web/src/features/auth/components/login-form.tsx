'use client';

import { useActionState } from 'react';
import { TextField } from '@/shared/ui/text-field';
import { login } from '../actions/login.action';
import type { LoginState } from '../types/login-state.type';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
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
        className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
