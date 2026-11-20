import type {
  CreatePushInput,
  CreatePushResult,
  CreateQrInput,
  CreateQrResult,
  PeyTransaction,
} from '../../src/modules/pey/interfaces/pey-codi.interface';
import { PeyError } from '../../src/modules/pey/errors/pey.error';

/**
 * pey simulado para las pruebas e2e: guarda lo que se le pidió y permite
 * hacer fallar la siguiente llamada con `failNext`.
 */
export class FakePeyClient {
  readonly pushes: CreatePushInput[] = [];
  readonly qrs: CreateQrInput[] = [];
  readonly transactions = new Map<string, PeyTransaction>();
  readonly qrPayments = new Map<string, PeyTransaction[]>();
  private nextError: PeyError | null = null;

  /** La siguiente llamada a pey falla con este error. */
  failNext(error: PeyError): void {
    this.nextError = error;
  }

  reset(): void {
    this.pushes.length = 0;
    this.qrs.length = 0;
    this.transactions.clear();
    this.qrPayments.clear();
    this.nextError = null;
  }

  createPush(input: CreatePushInput): Promise<CreatePushResult> {
    this.pushes.push(input);
    this.throwIfFailing();
    const transactionId = `TX${this.pushes.length}`;
    this.transactions.set(transactionId, {
      id: transactionId,
      status: 'PENDING',
      amount: input.amount,
      metadata: { externalMetadata: { ...input.metadata } },
    });
    return Promise.resolve({
      transactionId,
      codiId: `CODI${this.pushes.length}`.padEnd(20, '0'),
    });
  }

  createQr(input: CreateQrInput): Promise<CreateQrResult> {
    this.qrs.push(input);
    this.throwIfFailing();
    const id = `IDC${this.qrs.length}`;
    this.qrPayments.set(id, []);
    return Promise.resolve({
      id,
      qrString: `{"TYP":1,"v":"01","IDC":"${id}"}`,
    });
  }

  getTransaction(id: string): Promise<PeyTransaction> {
    this.throwIfFailing();
    const tx = this.transactions.get(id);
    if (!tx)
      return Promise.reject(
        new PeyError('not found', { type: 'NOT_FOUND', status: 404 }),
      );
    return Promise.resolve(tx);
  }

  listQrTransactions(qrId: string): Promise<PeyTransaction[]> {
    this.throwIfFailing();
    return Promise.resolve(this.qrPayments.get(qrId) ?? []);
  }

  private throwIfFailing(): void {
    if (!this.nextError) return;
    const error = this.nextError;
    this.nextError = null;
    throw error;
  }
}
