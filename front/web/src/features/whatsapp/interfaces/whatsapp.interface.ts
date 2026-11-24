/** GET /me/whatsapp de la API. phone: "55 1234 5678". */
export type WhatsAppLink = { linked: false } | { linked: true; phone: string };

/** POST /me/whatsapp/link-code: se muestra una sola vez. */
export interface LinkCode {
  code: string;
  /** Lo que hay que mandar por WhatsApp: "vincular 123456". */
  message: string;
  expiresAt: string;
}
