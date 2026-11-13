// Cliente mínimo de la API de pey (OpenAPI "CoDi API" 2026-10-20, https://docs.pey.mx).
//
// - Auth: Authorization: Bearer <API_KEY>
// - Montos en pesos con decimales (no centavos).
// - La API no tiene idempotency key: un POST nunca se reintenta solo, porque
//   reintentar un push puede mandar dos solicitudes de cobro al mismo celular.

export class PeyError extends Error {
  constructor(message, { status, type, requestId } = {}) {
    super(message);
    this.name = 'PeyError';
    this.status = status; // código HTTP (undefined si falló la red)
    this.type = type; // p. ej. INVALID_AMOUNT, INVALID_STATE, SERVICE_UNAVAILABLE
    this.requestId = requestId; // lo pide soporte de pey
  }
}

/** Convierte pesos a centavos enteros para comparar montos sin errores de punto flotante. */
export function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

export const MIN_EXPIRATION_SECONDS = 360;

export function createPeyClient({ apiKey, baseUrl = 'https://api.pey.mx', fetchImpl = fetch, timeoutMs = 20_000 }) {
  if (!apiKey) throw new Error('createPeyClient: falta apiKey');

  async function request(method, path, body) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const error = new PeyError(`No se pudo conectar con pey (${method} ${path}): ${cause.message}`, {
        type: cause.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      });
      error.cause = cause;
      throw error;
    }

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      const err = json?.error ?? {};
      throw new PeyError(err.message || `pey respondió HTTP ${response.status}`, {
        status: response.status,
        type: err.type || 'UNKNOWN',
        requestId: err.requestId,
      });
    }
    if (json === undefined) {
      throw new PeyError(`pey respondió algo que no es JSON (${method} ${path})`, {
        status: response.status,
        type: 'INVALID_RESPONSE',
      });
    }
    return json;
  }

  return {
    /**
     * POST /codi/pn — manda una solicitud de cobro CoDi al celular del pagador.
     * Devuelve { transactionId, codiId }.
     */
    async createPush({ amount, phoneNumber, concept, expiration, numRef, bankAccountId, metadata }) {
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        throw new PeyError('El monto debe ser mayor a 0 y máximo 1,000,000', { type: 'INVALID_AMOUNT' });
      }
      if (!/^[0-9]{10}$/.test(phoneNumber ?? '')) {
        throw new PeyError('El teléfono debe tener exactamente 10 dígitos, sin +52', { type: 'INVALID_PARAMETER' });
      }
      if (expiration !== undefined && (!Number.isInteger(expiration) || expiration < MIN_EXPIRATION_SECONDS)) {
        throw new PeyError(`La expiración mínima es de ${MIN_EXPIRATION_SECONDS} segundos`, {
          type: 'INVALID_PARAMETER',
        });
      }
      if (numRef !== undefined && !/^[0-9]{1,7}$/.test(numRef)) {
        throw new PeyError('numRef debe ser un texto de 1 a 7 dígitos', { type: 'INVALID_PARAMETER' });
      }
      const body = { amount, phoneNumber };
      if (concept !== undefined) body.concept = concept;
      if (expiration !== undefined) body.expiration = expiration;
      if (numRef !== undefined) body.numRef = numRef;
      if (bankAccountId !== undefined) body.bankAccountId = bankAccountId;
      if (metadata !== undefined) body.metadata = metadata;
      return request('POST', '/codi/pn', body);
    },

    /** GET /transaction/{id} — la fuente de verdad del estado de un cobro (PENDING | PAID). */
    async getTransaction(transactionId) {
      return request('GET', `/transaction/${encodeURIComponent(transactionId)}`);
    },
  };
}
