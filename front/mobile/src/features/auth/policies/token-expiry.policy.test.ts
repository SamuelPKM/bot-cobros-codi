import { isTokenExpired } from './token-expiry.policy';

const base64url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwtWith = (payload: object) =>
  ['eyJhbGciOiJIUzI1NiJ9', base64url(JSON.stringify(payload)), 'firma'].join('.');

describe('isTokenExpired', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const nowSeconds = now.getTime() / 1000;

  it('vigente mientras falte más de un minuto para su exp', () => {
    expect(isTokenExpired(jwtWith({ sub: 1, exp: nowSeconds + 3600 }), now)).toBe(false);
  });

  it('vencido si ya pasó o le queda menos de un minuto', () => {
    expect(isTokenExpired(jwtWith({ exp: nowSeconds - 5 }), now)).toBe(true);
    expect(isTokenExpired(jwtWith({ exp: nowSeconds + 30 }), now)).toBe(true);
  });

  it('lo da por vencido si no se puede leer', () => {
    expect(isTokenExpired('no-es-jwt', now)).toBe(true);
    expect(isTokenExpired(jwtWith({ sub: 1 }), now)).toBe(true);
    expect(isTokenExpired('a.%%%.c', now)).toBe(true);
  });
});
