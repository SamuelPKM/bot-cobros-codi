'use client';

import { useActionState } from 'react';
import { formatDateTime } from '@/shared/format/format';
import { FormAlert } from '@/shared/ui/form-alert';
import { secondaryButton } from '@/shared/ui/styles';
import { createLinkCode, type LinkCodeState } from '../actions/whatsapp-link.action';

const initialState: LinkCodeState = {};

/** Pide el código y muestra el mensaje que hay que mandar por WhatsApp. */
export function LinkCodeButton({ linked }: { linked: boolean }) {
  const [state, formAction, pending] = useActionState(createLinkCode, initialState);
  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <button type="submit" disabled={pending} className={secondaryButton}>
          {linked ? 'Ligar otro número' : 'Obtener código'}
        </button>
      </form>
      <FormAlert message={state.formError} />
      {state.code && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <p>Manda este mensaje desde tu WhatsApp al número de Cóbrale:</p>
          <p className="my-2 text-2xl font-semibold tracking-wider">{state.code.message}</p>
          <p className="text-emerald-900">
            Vence a las {formatDateTime(state.code.expiresAt)} y sirve una sola vez.
          </p>
        </div>
      )}
    </div>
  );
}
