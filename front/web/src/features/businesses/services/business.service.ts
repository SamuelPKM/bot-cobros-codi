import 'server-only';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import type { PublicBusiness } from '../interfaces/public-business.interface';

/** El negocio del admin que tiene la sesión. */
export async function getMyBusiness(): Promise<PublicBusiness> {
  const { business } = await authedRequest<{ business: PublicBusiness }>('/businesses/me');
  return business;
}
