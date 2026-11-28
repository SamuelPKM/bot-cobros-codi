import { resolveApiUrl } from './api-url.policy';

describe('resolveApiUrl', () => {
  it('quita las diagonales del final', () => {
    expect(resolveApiUrl('https://api.3-91-20-115.sslip.io//')).toBe(
      'https://api.3-91-20-115.sslip.io',
    );
  });

  it('exige HTTPS, salvo en la red local para desarrollo', () => {
    expect(() => resolveApiUrl('http://api.3-91-20-115.sslip.io')).toThrow(/HTTPS/);
    expect(resolveApiUrl('http://192.168.1.20:3000')).toBe('http://192.168.1.20:3000');
    expect(resolveApiUrl('http://10.0.2.2:3000')).toBe('http://10.0.2.2:3000');
    expect(resolveApiUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('falla claro si no está configurada o no es una URL', () => {
    expect(() => resolveApiUrl(undefined)).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => resolveApiUrl('  ')).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => resolveApiUrl('no es url')).toThrow(/EXPO_PUBLIC_API_URL/);
  });
});
