/** Cada cuánto corre el barrido. */
export const SWEEP_INTERVAL_MS = 30_000;

/** Llave del advisory lock de Postgres: una sola instancia barre a la vez. */
export const SWEEP_LOCK_KEY = 727_001;

export const SWEEP_INTERVAL_NAME = 'charges-sweeper';
