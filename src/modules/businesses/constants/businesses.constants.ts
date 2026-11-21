/** Token de inyección del SecretBox que cifra las credenciales de los negocios. */
export const BUSINESS_SECRET_BOX = Symbol('BUSINESS_SECRET_BOX');

/** Bytes aleatorios del slug público del webhook (24 caracteres en base64url). */
export const WEBHOOK_SLUG_BYTES = 18;
