/**
 * Tipos de error. Los de red (`TIMEOUT`, `NETWORK_ERROR`) significan
 * "no se sabe si pey lo procesó": un cobro en ese estado no se reintenta,
 * porque reintentar un push puede mandar dos cobros al mismo celular.
 */
export type PeyErrorType =
  | 'INVALID_AMOUNT'
  | 'INVALID_PARAMETER'
  | 'INVALID_RESPONSE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'
  // Cualquier otro `type` que mande pey (INVALID_STATE, SERVICE_UNAVAILABLE…).
  | (string & {});

export class PeyError extends Error {
  readonly type: PeyErrorType;
  /** Código HTTP; undefined si la petición no llegó a pey. */
  readonly status?: number;
  /** Lo pide el soporte de pey para rastrear la petición. */
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      type: PeyErrorType;
      status?: number;
      requestId?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'PeyError';
    this.type = options.type;
    this.status = options.status;
    this.requestId = options.requestId;
  }

  /** true cuando no se sabe si pey recibió la petición. */
  get isOutcomeUnknown(): boolean {
    return this.type === 'TIMEOUT' || this.type === 'NETWORK_ERROR';
  }
}
