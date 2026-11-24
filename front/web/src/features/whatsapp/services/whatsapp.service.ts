import 'server-only';
import { authedRequest } from '@/features/auth/services/authed-api.service';
import type { WhatsAppLink } from '../interfaces/whatsapp.interface';

export function getWhatsAppLink(): Promise<WhatsAppLink> {
  return authedRequest<WhatsAppLink>('/me/whatsapp');
}
