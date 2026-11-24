/** Una sesión dura un día; después hay que abrir otra. */
export const SESSION_TTL_HOURS = 24;

export const MAX_TEXT_LENGTH = 300;

/** Límites contra abuso (los cobros son reales). Cuentan en la base: valen con varias instancias. */
export const MESSAGES_PER_SESSION = 30;
export const MESSAGES_PER_IP = 120;
export const MESSAGES_WINDOW_MINUTES = 10;
export const SESSIONS_PER_IP_PER_HOUR = 20;
