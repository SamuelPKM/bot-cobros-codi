import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://cobrale:cobrale@localhost:5433/cobrale',
  AUTH_SECRET: 'x'.repeat(32),
  PEY_API_KEY: 'pey_key',
};

describe('validateEnv', () => {
  it('acepta la configuración mínima y aplica valores por defecto', () => {
    const env = validateEnv(base);
    expect(env).toEqual({
      DATABASE_URL: base.DATABASE_URL,
      DATABASE_SSL: false,
      AUTH_SECRET: base.AUTH_SECRET,
      PEY_API_KEY: 'pey_key',
      PEY_BASE_URL: 'https://api.pey.mx',
      PEY_WEBHOOK_SECRET: undefined,
      PORT: 3000,
      JWT_TTL: '12h',
      ADMIN_USERNAME: undefined,
      ADMIN_PASSWORD: undefined,
    });
  });

  it('acepta el admin inicial cuando vienen usuario y contraseña juntos', () => {
    const env = validateEnv({
      ...base,
      ADMIN_USERNAME: 'dueno',
      ADMIN_PASSWORD: 'admin-12345',
      JWT_TTL: '8h',
    });
    expect(env).toMatchObject({
      ADMIN_USERNAME: 'dueno',
      ADMIN_PASSWORD: 'admin-12345',
      JWT_TTL: '8h',
    });
  });

  it('exige usuario y contraseña del admin inicial juntos, con contraseña de 8+', () => {
    expect(() => validateEnv({ ...base, ADMIN_USERNAME: 'dueno' })).toThrow(
      'ADMIN_PASSWORD',
    );
    expect(() =>
      validateEnv({
        ...base,
        ADMIN_USERNAME: 'dueno',
        ADMIN_PASSWORD: 'corta',
      }),
    ).toThrow('ADMIN_PASSWORD');
  });

  it('exige un JWT_TTL con formato como 15m, 12h o 1d', () => {
    expect(() => validateEnv({ ...base, JWT_TTL: 'siempre' })).toThrow(
      'JWT_TTL',
    );
  });

  it('activa SSL para Neon y lee el puerto como número', () => {
    const env = validateEnv({
      ...base,
      DATABASE_SSL: 'true',
      PORT: '8080',
      PEY_WEBHOOK_SECRET: 'whsec_abc',
    });
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.PORT).toBe(8080);
    expect(env.PEY_WEBHOOK_SECRET).toBe('whsec_abc');
  });

  it.each(['DATABASE_URL', 'AUTH_SECRET', 'PEY_API_KEY'])(
    'falla si falta %s',
    (name) => {
      const env: Record<string, string> = { ...base };
      delete env[name];
      expect(() => validateEnv(env)).toThrow(name);
    },
  );

  it('exige un AUTH_SECRET de al menos 32 caracteres', () => {
    expect(() => validateEnv({ ...base, AUTH_SECRET: 'corto' })).toThrow(
      'AUTH_SECRET',
    );
  });

  it('exige que DATABASE_URL sea de postgres', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(
      'DATABASE_URL',
    );
  });

  it('exige que el secreto del webhook empiece con whsec_', () => {
    expect(() => validateEnv({ ...base, PEY_WEBHOOK_SECRET: 'otro' })).toThrow(
      'PEY_WEBHOOK_SECRET',
    );
  });

  it('reporta todos los errores juntos', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_URL[\s\S]*AUTH_SECRET[\s\S]*PEY_API_KEY/,
    );
  });
});
