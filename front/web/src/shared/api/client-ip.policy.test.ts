import { describe, expect, it } from 'vitest';
import { clientIpFrom } from './client-ip.policy';

describe('clientIpFrom', () => {
  it('toma la última IP de X-Forwarded-For: la que agregó el proxy de la plataforma', () => {
    expect(clientIpFrom('203.0.113.9')).toBe('203.0.113.9');
    // El visitante puede inventar las primeras; la última la pone el proxy.
    expect(clientIpFrom('1.1.1.1, 203.0.113.9')).toBe('203.0.113.9');
    expect(clientIpFrom('2001:db8::7')).toBe('2001:db8::7');
  });

  it('sin header o con basura: null (la API usa la IP de la conexión)', () => {
    expect(clientIpFrom(null)).toBeNull();
    expect(clientIpFrom('')).toBeNull();
    expect(clientIpFrom('no-es-ip')).toBeNull();
  });
});
