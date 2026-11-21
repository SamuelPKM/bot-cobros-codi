'use client';

import { useActionState } from 'react';
import { formatDateTime } from '@/shared/format/format';
import { CopyButton } from '@/shared/ui/copy-button';
import { FormAlert } from '@/shared/ui/form-alert';
import { ROLE_LABELS, ROLE_OPTIONS } from '@/shared/ui/role-options';
import { SelectField } from '@/shared/ui/select-field';
import { primaryButton } from '@/shared/ui/styles';
import { createInvitation, type CreateInvitationState } from '../actions/invitations.action';

const initialState: CreateInvitationState = {};

/** Crea una liga de un solo uso para que alguien se una al equipo. */
export function InviteForm() {
  const [state, formAction, pending] = useActionState(createInvitation, initialState);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <SelectField label="Rol" name="role" options={ROLE_OPTIONS} defaultValue="seller" />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? 'Creando…' : 'Crear invitación'}
        </button>
      </form>
      <FormAlert message={state.formError} />
      {state.created && (
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <p className="font-medium text-emerald-950">
            Invitación para {ROLE_LABELS[state.created.role].toLowerCase()}. Vence el{' '}
            {formatDateTime(state.created.expiresAt)} y sirve una sola vez.
          </p>
          <p className="break-all rounded bg-white px-3 py-2">{state.created.url}</p>
          <p className="text-emerald-900">
            Cópiala y mándala por donde quieras: solo se muestra esta vez.
          </p>
          <div>
            <CopyButton text={state.created.url} />
          </div>
        </div>
      )}
    </div>
  );
}
