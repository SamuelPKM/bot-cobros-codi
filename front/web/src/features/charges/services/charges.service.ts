import 'server-only';
import { notFound } from 'next/navigation';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import { ApiError } from '@/shared/api/api-client';
import type { PublicCharge } from '../interfaces/public-charge.interface';

/** Los últimos cobros que la persona puede ver (el admin, los de su negocio). */
export async function listCharges(limit = 50): Promise<PublicCharge[]> {
  const { charges } = await authedRequest<{ charges: PublicCharge[] }>(`/charges?limit=${limit}`);
  return charges;
}

/** Un cobro visible para la persona; 404 si no existe o es de otro. */
export async function getCharge(id: number): Promise<PublicCharge> {
  try {
    const { charge } = await authedRequest<{ charge: PublicCharge }>(`/charges/${id}`);
    return charge;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
}
