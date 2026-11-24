/** Cuánto dura el código para ligar un WhatsApp. */
export const LINK_CODE_TTL_MINUTES = 10;

/** Códigos equivocados permitidos por número antes de pausar (contra adivinar). */
export const LINK_MAX_FAILED_ATTEMPTS = 5;
export const LINK_ATTEMPTS_WINDOW_MS = 15 * 60_000;

/** Fuente en webhook_events: cada mensaje de Meta se atiende una sola vez. */
export const WHATSAPP_SOURCE = 'whatsapp';
