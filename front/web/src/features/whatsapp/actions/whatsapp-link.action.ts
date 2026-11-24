'use server';

import { refresh } from 'next/cache';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import { UNEXPECTED_ERROR } from '@/shared/forms/form-state.type';
import type { LinkCode } from '../interfaces/whatsapp.interface';

export interface LinkCodeState {
  code?: LinkCode;
  formError?: string;
}

/** Código de 6 dígitos (10 min) para ligar el WhatsApp de quien tiene la sesión. */
export async function createLinkCode(): Promise<LinkCodeState> {
  try {
    const { code, message, expiresAt } = await authedRequest<LinkCode>('/me/whatsapp/link-code', {
      method: 'POST',
    });
    return { code: { code, message, expiresAt } };
  } catch (error) {
    return { formError: error instanceof ApiError ? error.message : UNEXPECTED_ERROR };
  }
}

export async function unlinkWhatsApp(): Promise<void> {
  await authedRequest('/me/whatsapp', { method: 'DELETE' });
  refresh();
}
