import { describe, expect, it } from 'vitest';
import { secondsUntilExpiry } from './token-expiry.policy';

const jwtWith = (payload: object) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'firma'].join('.');

describe('secondsUntilExpiry', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const nowSeconds = now.getTime() / 1000;

  it('cuánto le falta al token para vencer (exp del JWT)', () => {
    expect(secondsUntilExpiry(jwtWith({ sub: 1, exp: nowSeconds + 3600 }), now)).toBe(3600);
  });

  it('0 si ya venció', () => {
    expect(secondsUntilExpiry(jwtWith({ exp: nowSeconds - 5 }), now)).toBe(0);
  });

  it('null si no es un JWT o no trae exp', () => {
    expect(secondsUntilExpiry('no-es-jwt', now)).toBeNull();
    expect(secondsUntilExpiry(jwtWith({ sub: 1 }), now)).toBeNull();
  });
});
