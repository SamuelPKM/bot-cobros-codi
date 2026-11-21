'use client';

import { useActionState } from 'react';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormNotice } from '@/shared/ui/form-notice';
import { ROLE_OPTIONS } from '@/shared/ui/role-options';
import { SelectField } from '@/shared/ui/select-field';
import { secondaryButton } from '@/shared/ui/styles';
import { TextField } from '@/shared/ui/text-field';
import { updateMember, type MemberState } from '../actions/members.action';

const initialState: MemberState = {};

/** Editar a una persona del equipo. La API impide dejar el negocio sin admin activo. */
export function MemberEditForm({ member }: { member: PublicUser }) {
  const [state, formAction, pending] = useActionState(updateMember, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2" noValidate>
      <input type="hidden" name="userId" value={member.id} />
      <div className="sm:col-span-2 flex flex-col gap-2">
        <FormAlert message={state.formError} />
        <FormNotice message={state.notice} />
      </div>
      <TextField label="Nombre" name="name" maxLength={80} defaultValue={member.name} error={errors.name} />
      <SelectField label="Rol" name="role" options={ROLE_OPTIONS} defaultValue={member.role} error={errors.role} />
      <TextField
        label="Tope por cobro (pesos, vacío = sin tope)"
        name="maxAmount"
        inputMode="decimal"
        defaultValue={member.maxAmount === null ? '' : String(member.maxAmount)}
        error={errors.maxAmount}
      />
      <TextField
        label="Contraseña nueva (opcional)"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input type="checkbox" name="active" defaultChecked={member.active} className="accent-emerald-700" />
        Puede cobrar (activa)
      </label>
      <div className="sm:text-right">
        <button type="submit" disabled={pending} className={secondaryButton}>
          {pending ? 'Guardando…' : 'Guardar'}
          <span className="sr-only"> a {member.name}</span>
        </button>
      </div>
    </form>
  );
}
