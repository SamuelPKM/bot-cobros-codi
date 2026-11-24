import type { PeyApi } from '../../pey/interfaces/pey-api.interface';

export interface RegisterBusinessInput {
  businessName: string;
  adminName: string;
  username: string;
  password: string;
  peyApiKey: string;
}

export interface UpdateBusinessInput {
  name?: string;
  peyApiKey?: string;
  peyWebhookSecret?: string;
}

/** El negocio como lo ve su admin: sin la API key ni el secreto. */
export interface PublicBusiness {
  id: number;
  name: string;
  peyApiKeyLast4: string;
  webhookConfigured: boolean;
  /** URL que el admin registra en el portal de pey. */
  webhookUrl: string;
}

/** Lo necesario para cobrar a nombre de un negocio. */
export interface BusinessPaymentContext {
  businessName: string;
  pey: PeyApi;
}

/** A dónde va un webhook: el negocio y su secreto (null si aún no lo registra). */
export interface WebhookTarget {
  businessId: number;
  secret: string | null;
}
