export type WhatsAppLinkView =
  | { linked: false }
  /** phone: "55 1234 5678". */
  | { linked: true; phone: string };

export interface LinkCodeView {
  code: string;
  /** Lo que hay que mandar por WhatsApp, listo para copiar. */
  message: string;
  expiresAt: string;
}
