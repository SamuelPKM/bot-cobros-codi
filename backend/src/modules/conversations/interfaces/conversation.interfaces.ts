/** Una respuesta del chat. Cada canal decide cómo mostrarla. */
export interface ConversationReply {
  text: string;
  /** Contenido del QR (tal cual lo da pey) para que el canal lo dibuje. */
  qrString?: string;
  /** Liga de pago para reenviar. */
  url?: string;
}

/** Lo mínimo de un cobro para describirlo en un mensaje. */
export interface ChargeDescription {
  amountCents: number;
  payerPhone: string | null;
  concept: string | null;
}
