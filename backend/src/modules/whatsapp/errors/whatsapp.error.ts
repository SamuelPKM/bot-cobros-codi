export class WhatsAppError extends Error {
  readonly status?: number;
  /** Código de error de Meta (p. ej. 131030: el número no está en la lista de prueba). */
  readonly code?: number;

  constructor(
    message: string,
    options: { status?: number; code?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'WhatsAppError';
    this.status = options.status;
    this.code = options.code;
  }
}
