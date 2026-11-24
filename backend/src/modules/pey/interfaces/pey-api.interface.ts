import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  CreatePushInput,
  CreatePushResult,
  CreateQrInput,
  CreateQrResult,
  PeyPaymentLink,
  PeyTransaction,
} from './pey-codi.interface';

/** Lo que el resto de la app usa de pey, con las credenciales de un negocio. */
export interface PeyApi {
  verifyApiKey(): Promise<void>;
  createPush(input: CreatePushInput): Promise<CreatePushResult>;
  createQr(input: CreateQrInput): Promise<CreateQrResult>;
  createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatePaymentLinkResult>;
  getTransaction(transactionId: string): Promise<PeyTransaction>;
  listQrTransactions(qrId: string): Promise<PeyTransaction[]>;
  getPaymentLink(linkId: string): Promise<PeyPaymentLink>;
}
