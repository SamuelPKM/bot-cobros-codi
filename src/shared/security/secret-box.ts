// Cifrado simétrico de secretos en reposo (API keys y secretos de webhook de
// cada negocio) con AES-256-GCM: confidencialidad e integridad. El formato
// guardado es "v1:<iv>:<tag>:<cifrado>" en base64url.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

export class SecretBox {
  private readonly key: Buffer;

  /** @param keyBase64 32 bytes aleatorios en base64 (ENCRYPTION_KEY). */
  constructor(keyBase64: string) {
    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32)
      throw new Error('La llave de cifrado debe tener 32 bytes en base64');
    this.key = key;
  }

  seal(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    return [VERSION, iv, cipher.getAuthTag(), encrypted]
      .map((part) =>
        typeof part === 'string' ? part : part.toString('base64url'),
      )
      .join(':');
  }

  /** Lanza si el sobre fue alterado o se cifró con otra llave. */
  open(sealed: string): string {
    const [version, iv, tag, encrypted] = sealed.split(':');
    if (version !== VERSION || !iv || !tag || encrypted === undefined) {
      throw new Error('Secreto cifrado con un formato desconocido');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
