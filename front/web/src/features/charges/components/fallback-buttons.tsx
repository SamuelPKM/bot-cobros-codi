'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/shared/ui/form-alert';
import { secondaryButton } from '@/shared/ui/styles';
import { showFallback, type FallbackState } from '../actions/charge-fallback.action';

const initialState: FallbackState = {};

/** Plan B si el push no le llegó al cliente: QR o liga del mismo cobro. */
export function FallbackButtons({ chargeId }: { chargeId: number }) {
  const [state, formAction, pending] = useActionState(showFallback, initialState);

  return (
    <div className="flex flex-col gap-2">
      <FormAlert message={state.formError} />
      <div className="flex flex-wrap gap-2">
        {(['qr', 'link'] as const).map((kind) => (
          <form key={kind} action={formAction}>
            <input type="hidden" name="chargeId" value={chargeId} />
            <input type="hidden" name="kind" value={kind} />
            <button type="submit" disabled={pending} className={secondaryButton}>
              {kind === 'qr' ? 'Mostrar QR' : 'Liga de pago'}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
