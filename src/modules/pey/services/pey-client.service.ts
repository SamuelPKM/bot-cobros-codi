import {
  DEFAULT_TIMEOUT_MS,
  MAX_AMOUNT,
  MIN_EXPIRATION_SECONDS,
} from '../constants/pey.constants';
import { PeyError } from '../errors/pey.error';
import type { PeyClientOptions } from '../interfaces/pey-client-options.interface';
import type {
  CreatePushInput,
  CreatePushResult,
  CreateQrInput,
  CreateQrResult,
  PeyTransaction,
} from '../interfaces/pey-codi.interface';

const PHONE = /^\d{10}$/;
const NUM_REF = /^\d{1,7}$/;

interface PeyErrorEnvelope {
  error?: { message?: string; type?: string; requestId?: string };
}

/**
 * Cliente de la API de pey (CoDi). Valida antes de llamar para no gastar una
 * petición en algo que pey rechazaría.
 *
 * La API no tiene llave de idempotencia: un POST **nunca** se reintenta solo.
 * Si falla la red o vence el tiempo, el error lo dice (`isOutcomeUnknown`) y
 * quien llama decide; el webhook ligará el pago por `metadata.chargeId`.
 */
export class PeyClient {
  private readonly timeoutMs: number;

  constructor(private readonly options: PeyClientOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** POST /codi/pn: manda una solicitud de cobro CoDi al celular del pagador. */
  async createPush(input: CreatePushInput): Promise<CreatePushResult> {
    assertAmount(input.amount);
    if (!PHONE.test(input.phoneNumber))
      throw invalid('El teléfono debe tener exactamente 10 dígitos, sin +52');
    if (input.expiration !== undefined) assertExpiration(input.expiration);
    if (input.numRef !== undefined) assertNumRef(input.numRef);

    return this.request<CreatePushResult>(
      'POST',
      '/codi/pn',
      compact({ ...input }),
    );
  }

  /** POST /codi/qr: QR CoDi con expiración obligatoria. */
  async createQr(input: CreateQrInput): Promise<CreateQrResult> {
    assertAmount(input.amount);
    assertExpiration(input.expiration);
    if (input.numRef !== undefined) assertNumRef(input.numRef);

    return this.request<CreateQrResult>(
      'POST',
      '/codi/qr',
      compact({ ...input, generateImage: false }),
    );
  }

  /** GET /transaction/{id}: estado real de un cobro (PENDING | PAID). */
  getTransaction(transactionId: string): Promise<PeyTransaction> {
    return this.request<PeyTransaction>(
      'GET',
      `/transaction/${encodeURIComponent(transactionId)}`,
    );
  }

  /** GET /transaction/codi/qr/{id}: pagos recibidos por un QR (la primera página basta: 20). */
  async listQrTransactions(qrId: string): Promise<PeyTransaction[]> {
    const page = await this.request<{ items?: PeyTransaction[] }>(
      'GET',
      `/transaction/codi/qr/${encodeURIComponent(qrId)}`,
    );
    return page.items ?? [];
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: object,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.options.fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      const timeout = (cause as Error).name === 'TimeoutError';
      throw new PeyError(
        `No se pudo conectar con pey (${method} ${path}): ${(cause as Error).message}`,
        { type: timeout ? 'TIMEOUT' : 'NETWORK_ERROR', cause },
      );
    }

    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      const error = (json as PeyErrorEnvelope | undefined)?.error ?? {};
      throw new PeyError(
        error.message ?? `pey respondió HTTP ${response.status}`,
        {
          type: error.type ?? 'UNKNOWN',
          status: response.status,
          requestId: error.requestId,
        },
      );
    }
    if (json === undefined) {
      throw new PeyError(
        `pey respondió algo que no es JSON (${method} ${path})`,
        {
          type: 'INVALID_RESPONSE',
          status: response.status,
        },
      );
    }
    return json as T;
  }
}

function assertAmount(amount: number): void {
  const valid =
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= MAX_AMOUNT &&
    Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;
  if (!valid)
    throw new PeyError(
      `El monto debe ser mayor a 0, máximo ${MAX_AMOUNT.toLocaleString('es-MX')} y con 2 decimales`,
      { type: 'INVALID_AMOUNT' },
    );
}

function assertExpiration(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < MIN_EXPIRATION_SECONDS)
    throw invalid(
      `La expiración mínima es de ${MIN_EXPIRATION_SECONDS} segundos`,
    );
}

function assertNumRef(numRef: string): void {
  if (!NUM_REF.test(numRef))
    throw invalid('numRef debe tener de 1 a 7 dígitos');
}

const invalid = (message: string) =>
  new PeyError(message, { type: 'INVALID_PARAMETER' });

/** Quita los campos undefined para no mandarlos a pey. */
function compact<T extends object>(body: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
