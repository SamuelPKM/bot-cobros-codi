'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormNotice } from '@/shared/ui/form-notice';
import { secondaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { updateBusiness, type BusinessSettingsState } from '../actions/update-business.action';
import type { BusinessSettingsField } from '../policies/business-settings.policy';

const initialState: BusinessSettingsState = {};

interface BusinessSettingFormProps {
  section: 'name' | 'apiKey' | 'webhook';
  field: BusinessSettingsField;
  label: string;
  /** Las llaves se escriben como contraseña y no se rellenan. */
  secret?: boolean;
  defaultValue?: string;
  hint?: string;
  submitLabel: string;
}

/** Una sección de Ajustes del negocio: un campo y su botón. */
export function BusinessSettingForm({
  section,
  field,
  label,
  secret,
  defaultValue,
  hint,
  submitLabel,
}: BusinessSettingFormProps) {
  const [state, formAction, pending] = useActionState(updateBusiness, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="section" value={section} />
      <FormAlert message={state.formError} />
      <FormNotice message={state.notice} />
      <TextField
        label={label}
        name={field}
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        defaultValue={secret ? undefined : defaultValue}
        error={state.fieldErrors?.[field]}
      />
      {hint && <p className="text-sm text-zinc-600">{hint}</p>}
      <div>
        <button type="submit" disabled={pending} className={secondaryButton}>
          {pending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
