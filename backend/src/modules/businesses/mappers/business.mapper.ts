import type { Business } from '../entities/business.entity';
import type { PublicBusiness } from '../interfaces/business.interfaces';

/** Única salida de un Business hacia la API: nunca expone credenciales. */
export function toPublicBusiness(
  business: Business,
  publicBaseUrl: string | undefined,
): PublicBusiness {
  return {
    id: business.id,
    name: business.name,
    peyApiKeyLast4: business.peyApiKeyLast4,
    webhookConfigured: Boolean(business.peyWebhookSecretSealed),
    webhookUrl: `${publicBaseUrl ?? ''}/webhooks/pey/${business.webhookSlug}`,
  };
}
