import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const stored = await hashPassword('tacos-123');
    await expect(verifyPassword('tacos-123', stored)).resolves.toBe(true);
    await expect(verifyPassword('tacos-124', stored)).resolves.toBe(false);
  });

  it('no guarda la contraseña en claro y usa sal distinta cada vez', async () => {
    const a = await hashPassword('tacos-123');
    const b = await hashPassword('tacos-123');
    expect(a).not.toContain('tacos-123');
    expect(a).not.toBe(b);
  });

  it('rechaza hashes inválidos sin lanzar', async () => {
    await expect(verifyPassword('x', 'no-es-un-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$abc$def')).resolves.toBe(false);
  });
});
