/** Cookie httpOnly con el Bearer token de la API. El JavaScript del navegador nunca lo ve. */
export const SESSION_COOKIE = 'cobrale_session';

/** Si no se puede leer el vencimiento del token: el JWT_TTL por defecto de la API. */
export const DEFAULT_SESSION_SECONDS = 12 * 60 * 60;

/** A dónde va la persona al entrar. */
export const HOME_AFTER_LOGIN = '/panel';
