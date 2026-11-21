import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  CreatePushInput,
  CreatePushResult,
  CreateQrInput,
  CreateQrResult,
  PeyPaymentLink,
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
  readonly links: CreatePaymentLinkInput[] = [];
  readonly paymentLinks = new Map<string, PeyPaymentLink>();
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
    this.links.length = 0;
    this.paymentLinks.clear();
    this.nextError = null;
  }

  createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatePaymentLinkResult> {
    this.links.push(input);
    this.throwIfFailing();
    const id = `LINK${this.links.length}`;
    this.paymentLinks.set(id, {
      id,
      status: 'pending',
      amount: input.amount,
      clientReferenceId: input.clientReferenceId,
      transactions: [],
    });
    return Promise.resolve({
      id,
      url: `https://app.mipey.mx/payment-link/${id}`,
    });
  }

  getPaymentLink(id: string): Promise<PeyPaymentLink> {
    this.throwIfFailing();
    const link = this.paymentLinks.get(id);
    if (!link)
      return Promise.reject(
        new PeyError('not found', { type: 'NOT_FOUND', status: 404 }),
      );
    return Promise.resolve(link);
  }

  /** Simula que el cliente pagó la liga (con propina opcional, que no cuenta contra el cobro). */
  payLink(linkId: string, { tip = 0 } = {}): void {
    const link = this.paymentLinks.get(linkId);
    if (!link) throw new Error(`No existe la liga ${linkId}`);
    link.status = 'paid';
    link.transactions = [
      {
        transactionId: `TXL-${linkId}`,
        paymentMethod: 'CARD',
        datePaid: 1790724999,
        amount: link.amount + tip,
        amountBreakdown: { base: link.amount, tip, fee: 0 },
      },
    ];
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
