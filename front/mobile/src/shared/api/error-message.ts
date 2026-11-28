import { ApiError } from './api-client';

export const UNEXPECTED_ERROR = 'Algo salió mal. Intenta de nuevo en un momento.';

/** Texto para la persona: el de la API si lo hay; nunca detalles técnicos. */
export const messageFor = (error: unknown): string =>
  error instanceof ApiError ? error.message : UNEXPECTED_ERROR;
