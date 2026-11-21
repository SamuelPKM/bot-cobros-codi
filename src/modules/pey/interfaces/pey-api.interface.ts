import type {
  CreatePushInput,
  CreatePushResult,
  CreateQrInput,
  CreateQrResult,
  PeyTransaction,
} from './pey-codi.interface';

/** Lo que el resto de la app usa de pey, con las credenciales de un negocio. */
export interface PeyApi {
  verifyApiKey(): Promise<void>;
  createPush(input: CreatePushInput): Promise<CreatePushResult>;
  createQr(input: CreateQrInput): Promise<CreateQrResult>;
  getTransaction(transactionId: string): Promise<PeyTransaction>;
  listQrTransactions(qrId: string): Promise<PeyTransaction[]>;
}
