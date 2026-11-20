/** Cuerpo de un webhook de pey (solo los campos que usamos). */
export interface PeyWebhookEvent {
  type?: string;
  transactionId?: string;
  /** Solo en codi.qr.payment_received: IDC de Banxico. */
  codiQrId?: string;
  amount?: number;
  /** Unix, segundos. */
  datePaid?: number;
  metadata?: {
    trackingKey?: string;
    externalMetadata?: Record<string, unknown>;
  };
}

export interface VerifiedWebhook {
  /** Header webhook-id: llave de idempotencia de la entrega. */
  id: string;
  event: PeyWebhookEvent;
}

/** Cómo terminó de procesarse un webhook (se guarda y se responde a pey). */
export type WebhookResult =
  | 'paid'
  | 'already_paid'
  | 'extra_payment'
  | 'amount_mismatch'
  | 'unknown_charge'
  | 'missing_transaction_id'
  | 'ignored'
  | 'duplicate';
