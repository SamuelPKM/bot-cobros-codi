import { forwardedClientIp } from './client-ip.policy';

const SECRET = 's'.repeat(40);

describe('forwardedClientIp', () => {
  it('con el secreto correcto toma la IP que manda la web', () => {
    expect(
      forwardedClientIp(
        { 'x-cobrale-proxy': SECRET, 'x-cobrale-client-ip': '198.51.100.7' },
        SECRET,
      ),
    ).toBe('198.51.100.7');
    expect(
      forwardedClientIp(
        { 'x-cobrale-proxy': SECRET, 'x-cobrale-client-ip': '2001:db8::1' },
        SECRET,
      ),
    ).toBe('2001:db8::1');
  });

  it('sin secreto configurado, con otro secreto o con una IP inválida: null', () => {
    const headers = {
      'x-cobrale-proxy': SECRET,
      'x-cobrale-client-ip': '198.51.100.7',
    };
    expect(forwardedClientIp(headers, undefined)).toBeNull();
    expect(forwardedClientIp(headers, 'x'.repeat(40))).toBeNull();
    expect(
      forwardedClientIp(
        { 'x-cobrale-proxy': SECRET, 'x-cobrale-client-ip': '1.2.3' },
        SECRET,
      ),
    ).toBeNull();
    expect(
      forwardedClientIp({ 'x-cobrale-client-ip': '198.51.100.7' }, SECRET),
    ).toBeNull();
  });
});
