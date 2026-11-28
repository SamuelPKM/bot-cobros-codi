import type { ApiRequest } from '@/shared/api/api-client';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import type { NewChargeInput } from '../policies/new-charge-form.policy';

const LIST_LIMIT = 30;

/** Los últimos cobros que la persona puede ver (el admin, los de su negocio). */
export async function listCharges(request: ApiRequest): Promise<PublicCharge[]> {
  const { charges } = await request<{ charges: PublicCharge[] }>(`/charges?limit=${LIST_LIMIT}`);
  return charges;
}

export async function getCharge(request: ApiRequest, id: number): Promise<PublicCharge> {
  const { charge } = await request<{ charge: PublicCharge }>(`/charges/${id}`);
  return charge;
}

/** Un solo POST: si falla o tarda, no se reintenta (podría cobrar dos veces). */
export async function createCharge(request: ApiRequest, input: NewChargeInput): Promise<PublicCharge> {
  const { charge } = await request<{ charge: PublicCharge }>('/charges', {
    method: 'POST',
    body: input,
  });
  return charge;
}

/** Plan B del mismo cobro: QR para escanear o liga de pago para reenviar. */
export async function addFallback(
  request: ApiRequest,
  id: number,
  kind: 'qr' | 'link',
): Promise<PublicCharge> {
  const { charge } = await request<{ charge: PublicCharge }>(`/charges/${id}/${kind}`, {
    method: 'POST',
  });
  return charge;
}
