// Contratos de la API de pey (OpenAPI "CoDi API" 2026-10-20, https://docs.pey.mx).
// Los montos van en pesos con hasta 2 decimales.

/** Hasta 50 pares; claves de máx. 40 caracteres y valores escalares de máx. 500. */
export type PeyMetadata = Record<string, string | number | boolean>;

/** POST /codi/pn: solicitud de cobro CoDi al celular del pagador. */
export interface CreatePushInput {
  amount: number;
  /** 10 dígitos, sin +52. */
  phoneNumber: string;
  concept?: string;
  /** Segundos; mínimo 360. */
  expiration?: number;
  /** 1 a 7 dígitos. */
  numRef?: string;
  bankAccountId?: string;
  metadata?: PeyMetadata;
}

export interface CreatePushResult {
  transactionId: string;
  /** Folio de Banxico, 20 dígitos. */
  codiId: string;
}

/** POST /codi/qr: QR CoDi que el pagador escanea. */
export interface CreateQrInput {
  amount: number;
  concept?: string;
  /** Segundos; obligatorio y mínimo 360 (un QR sin expiración puede cobrarse varias veces). */
  expiration: number;
  numRef?: string;
  bankAccountId?: string;
  metadata?: PeyMetadata;
}

export interface CreateQrResult {
  /** IDC de Banxico. */
  id: string;
  /** Contenido del QR: se codifica tal cual, sin parsearlo ni reformatearlo. */
  qrString: string;
}

export type PeyTransactionStatus = 'PENDING' | 'PAID';

/** GET /transaction/{id}: la fuente de verdad del estado de un cobro. */
export interface PeyTransaction {
  id: string;
  status: PeyTransactionStatus;
  amount: number;
  amountBreakdown?: { base?: number; tip?: number; fee?: number };
  paymentMethod?: 'CODI' | 'CARD';
  payableType?: string;
  /** Unix, segundos. */
  datePaid?: number;
  metadata?: {
    trackingKey?: string;
    externalMetadata?: PeyMetadata;
  };
}
