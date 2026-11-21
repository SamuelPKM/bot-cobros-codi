// Valida las variables de entorno al arrancar (ConfigModule `validate`).
// Si algo falta, el servidor no arranca y dice exactamente qué corregir.
//
// No hay credenciales de pey aquí: cada negocio registra su propia API key
// (regla 7.3(c) del hackatón: los cobros van a la cuenta del titular de las
// credenciales). Se guardan cifradas con ENCRYPTION_KEY.

/** Duración como la entiende @nestjs/jwt: 15m, 12h, 1d… */
export type Duration = `${number}${'s' | 'm' | 'h' | 'd'}`;

const isDuration = (value: string): value is Duration =>
  /^\d+[smhd]$/.test(value);

export interface Env {
  DATABASE_URL: string;
  /** true en Neon; false en el Postgres local de Docker. */
  DATABASE_SSL: boolean;
  AUTH_SECRET: string;
  /** 32 bytes en base64: cifra las API keys y secretos de webhook de los negocios. */
  ENCRYPTION_KEY: string;
  /** URL pública HTTPS de la API, para mostrar a cada negocio la URL de su webhook. */
  PUBLIC_BASE_URL: string | undefined;
  PEY_BASE_URL: string;
  PORT: number;
  /** Vigencia del Bearer token: 15m, 12h, 1d… */
  JWT_TTL: Duration;
  /** Opcional: token de acceso de Expo si activas "Enhanced Security for Push Notifications". */
  EXPO_ACCESS_TOKEN: string | undefined;
  /** Barrido periódico de cobros (true por defecto; las pruebas lo apagan). */
  SWEEPER_ENABLED: boolean;
  /** true detrás de un proxy (Render): toma la IP real de X-Forwarded-For para los límites. */
  TRUST_PROXY: boolean;
  /** Orígenes que pueden llamar la API desde un navegador (la demo de Expo web). */
  CORS_ORIGINS: string[];
}

/** Un origen: esquema y host (con puerto opcional), sin ruta ni comodines. */
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const databaseUrl = text(raw.DATABASE_URL);
  if (!databaseUrl) errors.push('Falta DATABASE_URL');
  else if (!/^postgres(ql)?:\/\//.test(databaseUrl))
    errors.push('DATABASE_URL debe empezar con postgres://');

  const authSecret = text(raw.AUTH_SECRET);
  if (!authSecret) errors.push('Falta AUTH_SECRET');
  else if (authSecret.length < 32)
    errors.push('AUTH_SECRET debe tener al menos 32 caracteres');

  const encryptionKey = text(raw.ENCRYPTION_KEY);
  if (!encryptionKey) errors.push('Falta ENCRYPTION_KEY');
  else if (Buffer.from(encryptionKey, 'base64').length !== 32)
    errors.push('ENCRYPTION_KEY debe ser 32 bytes en base64');

  const publicBaseUrl = text(raw.PUBLIC_BASE_URL)?.replace(/\/+$/, '');
  if (publicBaseUrl && !/^https:\/\/[^/]+$/.test(publicBaseUrl))
    errors.push('PUBLIC_BASE_URL debe ser https:// y sin ruta');

  const port = Number(text(raw.PORT) ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    errors.push('PORT debe ser un número de puerto');

  const jwtTtl = text(raw.JWT_TTL) ?? '12h';
  if (!isDuration(jwtTtl))
    errors.push('JWT_TTL debe tener la forma 15m, 12h o 1d');

  const corsOrigins = (text(raw.CORS_ORIGINS) ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const badOrigins = corsOrigins.filter((origin) => !ORIGIN.test(origin));
  if (badOrigins.length > 0)
    errors.push(
      `CORS_ORIGINS solo acepta orígenes como https://mi-demo.app (sin ruta ni *): ${badOrigins.join(', ')}`,
    );

  if (errors.length > 0) {
    throw new Error(
      `Configuración inválida (revisa tu .env):\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    DATABASE_URL: databaseUrl!,
    DATABASE_SSL: text(raw.DATABASE_SSL) === 'true',
    AUTH_SECRET: authSecret!,
    ENCRYPTION_KEY: encryptionKey!,
    PUBLIC_BASE_URL: publicBaseUrl,
    PEY_BASE_URL: (text(raw.PEY_BASE_URL) ?? 'https://api.pey.mx').replace(
      /\/+$/,
      '',
    ),
    PORT: port,
    JWT_TTL: jwtTtl as Duration,
    EXPO_ACCESS_TOKEN: text(raw.EXPO_ACCESS_TOKEN),
    SWEEPER_ENABLED: text(raw.SWEEPER_ENABLED) !== 'false',
    TRUST_PROXY: text(raw.TRUST_PROXY) === 'true',
    CORS_ORIGINS: corsOrigins,
  };
}
