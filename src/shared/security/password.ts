// Contraseñas con scrypt (node:crypto, sin dependencias nativas).
// Formato guardado: "scrypt$<sal base64url>$<hash base64url>".

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltText, keyText] = stored.split('$');
  if (scheme !== 'scrypt' || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;
  const key = await scryptAsync(
    password,
    Buffer.from(saltText, 'base64url'),
    KEY_LENGTH,
  );
  return timingSafeEqual(key, expected);
}
