import type { PeyApi } from '../../src/modules/pey/interfaces/pey-api.interface';
import { PeyError } from '../../src/modules/pey/errors/pey.error';
import { FakePeyClient } from './fake-pey-client';

/**
 * Reemplaza a PeyClientFactory: todos los negocios comparten el mismo pey
 * simulado (`client`), pero cada llamada queda registrada con la API key que
 * la hizo, para probar que cada negocio cobra con SUS credenciales.
 */
export class FakePeyClientFactory {
  readonly client = new FakePeyClient();
  /** API key de cada llamada a pey, en orden. */
  readonly calls: { apiKey: string; method: string }[] = [];
  /** Keys que pey rechaza con 401. */
  readonly invalidKeys = new Set<string>();
  private validationError: PeyError | null = null;

  /** La siguiente validación de API key falla con este error (p. ej. pey caído). */
  failNextValidation(error: PeyError): void {
    this.validationError = error;
  }

  reset(): void {
    this.client.reset();
    this.calls.length = 0;
    this.invalidKeys.clear();
    this.validationError = null;
  }

  keysUsedFor(method: string): string[] {
    return this.calls.filter((c) => c.method === method).map((c) => c.apiKey);
  }

  create(apiKey: string): PeyApi {
    const record = (method: string) => this.calls.push({ apiKey, method });
    return {
      verifyApiKey: () => {
        record('verifyApiKey');
        if (this.validationError) {
          const error = this.validationError;
          this.validationError = null;
          return Promise.reject(error);
        }
        if (this.invalidKeys.has(apiKey)) {
          return Promise.reject(
            new PeyError('Unauthorized', { type: 'UNAUTHORIZED', status: 401 }),
          );
        }
        return Promise.resolve();
      },
      createPush: (input) => (
        record('createPush'),
        this.client.createPush(input)
      ),
      createQr: (input) => (record('createQr'), this.client.createQr(input)),
      getTransaction: (id) => (
        record('getTransaction'),
        this.client.getTransaction(id)
      ),
      listQrTransactions: (id) => (
        record('listQrTransactions'),
        this.client.listQrTransactions(id)
      ),
      createPaymentLink: (input) => (
        record('createPaymentLink'),
        this.client.createPaymentLink(input)
      ),
      getPaymentLink: (id) => (
        record('getPaymentLink'),
        this.client.getPaymentLink(id)
      ),
    };
  }
}
