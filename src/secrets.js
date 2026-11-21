// Cifrado de los secretos que cada negocio le confía a Cóbrale: su API key de
// pey y el secreto de su webhook. Se guardan con AES-256-GCM, así una copia de
// la base sin SECRETS_KEY no sirve para cobrar a nombre de nadie.
//
// Formato: "v1:<iv>:<etiqueta>:<cifrado>", cada parte en base64url.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * @param secretsKey texto largo y aleatorio (por ejemplo, el que genera Render).
 *   Si se pierde o se cambia, los negocios tienen que volver a conectar su cuenta.
 */
export function createSecretBox(secretsKey) {
  if (!secretsKey || String(secretsKey).length < 32) {
    throw new Error('SECRETS_KEY debe tener al menos 32 caracteres');
  }
  const key = createHash('sha256').update(String(secretsKey)).digest();

  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
      return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join(':');
    },

    /** El texto original, o null si no se puede abrir (otra llave o dato alterado). */
    open(sealed) {
      const [version, iv, tag, data] = String(sealed ?? '').split(':');
      if (version !== 'v1' || !iv || !tag || data === undefined) return null;
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
