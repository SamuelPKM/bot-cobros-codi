/** Expiración mínima que acepta pey para push y QR (6 minutos). */
export const MIN_EXPIRATION_SECONDS = 360;

/** Monto máximo por cobro que acepta pey, en pesos. */
export const MAX_AMOUNT = 1_000_000;

/** Tiempo máximo de espera de una llamada a pey. */
export const DEFAULT_TIMEOUT_MS = 20_000;

/** Token de inyección del `fetch` que usa PeyClient (se reemplaza en pruebas). */
export const PEY_FETCH = Symbol('PEY_FETCH');
