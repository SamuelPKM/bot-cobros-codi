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

  /** Simula que el cliente aprobó el push en su banco. */
  pay(
    transactionId: string,
    { trackingKey = 'RASTREO1', datePaid = 1790724758 } = {},
  ): void {
    const tx = this.transactions.get(transactionId);
    if (!tx) throw new Error(`No existe la transacción ${transactionId}`);
    tx.status = 'PAID';
    tx.datePaid = datePaid;
    tx.amountBreakdown = { base: tx.amount };
    tx.metadata = { ...tx.metadata, trackingKey };
  }

  /** Simula que el cliente escaneó y pagó el QR. Devuelve el transactionId del pago. */
  payQr(qrId: string, { trackingKey = 'RASTREOQR' } = {}): string {
    const index = Number(qrId.replace('IDC', '')) - 1;
    const qr = this.qrs[index];
    const payments = this.qrPayments.get(qrId);
    if (!qr || !payments) throw new Error(`No existe el QR ${qrId}`);
    const tx: PeyTransaction = {
      id: `TXQ-${qrId}-${payments.length + 1}`,
      status: 'PAID',
      amount: qr.amount,
      amountBreakdown: { base: qr.amount },
      datePaid: 1790725000,
      metadata: { trackingKey, externalMetadata: { ...qr.metadata } },
    };
    payments.push(tx);
    this.transactions.set(tx.id, tx);
    return tx.id;
  }

  private throwIfFailing(): void {
    if (!this.nextError) return;
    const error = this.nextError;
    this.nextError = null;
    throw error;
  }
}
