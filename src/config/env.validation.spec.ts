import { validateEnv } from './env.validation';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const base = {
  DATABASE_URL: 'postgres://cobrale:cobrale@localhost:5433/cobrale',
  AUTH_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY,
};

describe('validateEnv', () => {
  it('acepta la configuración mínima y aplica valores por defecto', () => {
    expect(validateEnv(base)).toEqual({
      DATABASE_URL: base.DATABASE_URL,
      DATABASE_SSL: false,
      AUTH_SECRET: base.AUTH_SECRET,
      ENCRYPTION_KEY,
      PUBLIC_BASE_URL: undefined,
      PEY_BASE_URL: 'https://api.pey.mx',
      PORT: 3000,
      JWT_TTL: '12h',
      EXPO_ACCESS_TOKEN: undefined,
      SWEEPER_ENABLED: true,
      TRUST_PROXY: false,
      CORS_ORIGINS: [],
    });
  });

  it('ya no pide credenciales de pey: cada negocio registra su propia API key', () => {
    const env = validateEnv(base) as unknown as Record<string, unknown>;
    expect(env).not.toHaveProperty('PEY_API_KEY');
    expect(env).not.toHaveProperty('PEY_WEBHOOK_SECRET');
  });

  it('exige una ENCRYPTION_KEY de 32 bytes en base64 para cifrar las API keys', () => {
    expect(() => validateEnv({ ...base, ENCRYPTION_KEY: 'corta' })).toThrow(
      'ENCRYPTION_KEY',
    );
  });

  it('acepta PUBLIC_BASE_URL https sin "/" final, para armar la URL del webhook', () => {
    expect(
      validateEnv({
        ...base,
        PUBLIC_BASE_URL: 'https://cobrale-api.onrender.com/',
      }).PUBLIC_BASE_URL,
    ).toBe('https://cobrale-api.onrender.com');
    expect(() =>
      validateEnv({ ...base, PUBLIC_BASE_URL: 'http://inseguro.com' }),
    ).toThrow('PUBLIC_BASE_URL');
  });

  it('lee TRUST_PROXY y la lista de orígenes permitidos para CORS', () => {
    const env = validateEnv({
      ...base,
      TRUST_PROXY: 'true',
      CORS_ORIGINS: 'https://cobrale-demo.netlify.app, http://localhost:8081',
    });
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.CORS_ORIGINS).toEqual([
      'https://cobrale-demo.netlify.app',
      'http://localhost:8081',
    ]);
  });

  it('rechaza orígenes CORS que no son URLs http(s) sin ruta, y el comodín', () => {
    for (const value of [
      '*',
      'cobrale.app',
      'https://cobrale.app/login',
      'ftp://x.com',
    ]) {
      expect(() => validateEnv({ ...base, CORS_ORIGINS: value })).toThrow(
        'CORS_ORIGINS',
      );
    }
  });

  it('permite apagar el barrido (pruebas) y configurar el token de Expo', () => {
    const env = validateEnv({
      ...base,
      SWEEPER_ENABLED: 'false',
      EXPO_ACCESS_TOKEN: 'expo-token',
    });
    expect(env.SWEEPER_ENABLED).toBe(false);
    expect(env.EXPO_ACCESS_TOKEN).toBe('expo-token');
  });

  it('exige un JWT_TTL con formato como 15m, 12h o 1d', () => {
    expect(validateEnv({ ...base, JWT_TTL: '8h' }).JWT_TTL).toBe('8h');
    expect(() => validateEnv({ ...base, JWT_TTL: 'siempre' })).toThrow(
      'JWT_TTL',
    );
  });

  it('activa SSL para Neon y lee el puerto como número', () => {
    const env = validateEnv({ ...base, DATABASE_SSL: 'true', PORT: '8080' });
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.PORT).toBe(8080);
  });

  it.each(['DATABASE_URL', 'AUTH_SECRET', 'ENCRYPTION_KEY'])(
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

  it('reporta todos los errores juntos', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_URL[\s\S]*AUTH_SECRET[\s\S]*ENCRYPTION_KEY/,
    );
  });
});
