'use server';

import { redirect } from 'next/navigation';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { field, UNEXPECTED_ERROR, type FormState } from '@/shared/forms/form-state.type';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { parseNewChargeForm, type NewChargeField } from '../policies/new-charge-form.policy';

export type NewChargeState = FormState<NewChargeField>;

/** Nuevo cobro (push, QR o liga). La API aplica el tope y los límites de la persona. */
export async function createCharge(
  _previous: NewChargeState,
  form: FormData,
): Promise<NewChargeState> {
  const values = {
    method: field(form, 'method'),
    phone: field(form, 'phone'),
    amount: field(form, 'amount'),
    tipOption: field(form, 'tipOption'),
    tip: field(form, 'tip'),
    concept: field(form, 'concept'),
  };
  const parsed = parseNewChargeForm(form);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  let chargeId: number;
  try {
    const { charge } = await authedRequest<{ charge: PublicCharge }>('/charges', {
      method: 'POST',
      body: parsed.data,
    });
    chargeId = charge.id;
  } catch (error) {
    return { formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR, values };
  }
  redirect(`/panel/cobros/${chargeId}`);
}
