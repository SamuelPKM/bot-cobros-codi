'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { primaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { registerBusiness, type RegisterState } from '../actions/register.action';

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerBusiness, initialState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert message={state.formError} />
      <TextField
        label="Nombre del negocio"
        name="businessName"
        maxLength={30}
        defaultValue={values.businessName}
        error={errors.businessName}
        required
      />
      <TextField
        label="Tu nombre"
        name="adminName"
        autoComplete="name"
        maxLength={80}
        defaultValue={values.adminName}
        error={errors.adminName}
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
      <div className="flex flex-col gap-1">
        <TextField
          label="API key de pey"
          name="peyApiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          error={errors.peyApiKey}
          required
        />
        <p className="text-sm text-zinc-600">
          La creas en portal.mipey.mx → Desarrollador → Crear API Key. Los pagos llegan a la
          cuenta de esa API key; la guardamos cifrada y nunca se vuelve a mostrar.
        </p>
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
