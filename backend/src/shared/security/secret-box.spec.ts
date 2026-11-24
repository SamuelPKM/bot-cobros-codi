import { randomBytes } from 'node:crypto';
import { SecretBox } from './secret-box';

const KEY = randomBytes(32).toString('base64');

describe('SecretBox (AES-256-GCM)', () => {
  const box = new SecretBox(KEY);

  it('cifra y descifra', () => {
    const sealed = box.seal('pey_live_abc123');
    expect(sealed).not.toContain('pey_live_abc123');
    expect(box.open(sealed)).toBe('pey_live_abc123');
  });

  it('usa un IV distinto cada vez', () => {
    expect(box.seal('misma')).not.toBe(box.seal('misma'));
  });

  it('detecta un texto cifrado alterado', () => {
    const sealed = box.seal('secreto');
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    expect(() => box.open(tampered)).toThrow();
  });

  it('no abre con otra llave', () => {
    const other = new SecretBox(randomBytes(32).toString('base64'));
    expect(() => other.open(box.seal('secreto'))).toThrow();
  });

  it('rechaza un formato desconocido', () => {
    expect(() => box.open('no-es-un-sobre')).toThrow(/formato/);
  });

  it('exige una llave de 32 bytes en base64', () => {
    expect(() => new SecretBox('corta')).toThrow(/32 bytes/);
  });
});
