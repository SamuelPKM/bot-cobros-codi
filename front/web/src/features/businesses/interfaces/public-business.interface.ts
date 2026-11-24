/** GET /businesses/me (solo admin): nunca trae la API key ni el secreto. */
export interface PublicBusiness {
  id: number;
  name: string;
  peyApiKeyLast4: string;
  webhookConfigured: boolean;
  /** URL que el admin registra en el portal de pey. */
  webhookUrl: string;
  /** Cambia con cada logo nuevo; null sin logo. */
  logoVersion: string | null;
  /** false si el servidor no tiene dónde guardar logos. */
  logosEnabled: boolean;
}
