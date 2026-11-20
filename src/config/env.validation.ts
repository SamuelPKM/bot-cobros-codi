// Valida las variables de entorno al arrancar (ConfigModule `validate`).
// Si algo falta, el servidor no arranca y dice exactamente qué corregir.

/** Duración como la entiende @nestjs/jwt: 15m, 12h, 1d… */
export type Duration = `${number}${'s' | 'm' | 'h' | 'd'}`;

const isDuration = (value: string): value is Duration =>
  /^\d+[smhd]$/.test(value);

export interface Env {
  DATABASE_URL: string;
  /** true en Neon; false en el Postgres local de Docker. */
  DATABASE_SSL: boolean;
  AUTH_SECRET: string;
  PEY_API_KEY: string;
  PEY_BASE_URL: string;
  /** Solo existe después de registrar el webhook en el portal de pey. */
  PEY_WEBHOOK_SECRET: string | undefined;
  PORT: number;
  /** Vigencia del Bearer token: 15m, 12h, 1d… */
  JWT_TTL: Duration;
  /** Admin que se crea al arrancar si no hay ninguno. */
  ADMIN_USERNAME: string | undefined;
  ADMIN_PASSWORD: string | undefined;
  /** Nombre del negocio al inicio del concepto que ve quien paga (el banco solo muestra al titular). */
  BUSINESS_NAME: string;
  /** Opcional: token de acceso de Expo si activas "Enhanced Security for Push Notifications". */
  EXPO_ACCESS_TOKEN: string | undefined;
  /** Barrido periódico de cobros (true por defecto; las pruebas lo apagan). */
  SWEEPER_ENABLED: boolean;
}

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

  const peyApiKey = text(raw.PEY_API_KEY);
  if (!peyApiKey) errors.push('Falta PEY_API_KEY');

  const webhookSecret = text(raw.PEY_WEBHOOK_SECRET);
  if (webhookSecret && !webhookSecret.startsWith('whsec_'))
    errors.push('PEY_WEBHOOK_SECRET debe empezar con whsec_');

  const port = Number(text(raw.PORT) ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    errors.push('PORT debe ser un número de puerto');

  const jwtTtl = text(raw.JWT_TTL) ?? '12h';
  if (!isDuration(jwtTtl))
    errors.push('JWT_TTL debe tener la forma 15m, 12h o 1d');

  const adminUsername = text(raw.ADMIN_USERNAME);
  const adminPassword = text(raw.ADMIN_PASSWORD);
  if (adminUsername && !adminPassword)
    errors.push('Falta ADMIN_PASSWORD (va junto con ADMIN_USERNAME)');
  if (adminPassword && !adminUsername)
    errors.push('Falta ADMIN_USERNAME (va junto con ADMIN_PASSWORD)');
  if (adminPassword && adminPassword.length < 8)
    errors.push('ADMIN_PASSWORD debe tener al menos 8 caracteres');

  const businessName = text(raw.BUSINESS_NAME) ?? 'Cóbrale';
  if (businessName.length > 30)
    errors.push('BUSINESS_NAME debe tener máximo 30 caracteres');

  if (errors.length > 0) {
    throw new Error(
      `Configuración inválida (revisa tu .env):\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    DATABASE_URL: databaseUrl!,
    DATABASE_SSL: text(raw.DATABASE_SSL) === 'true',
    AUTH_SECRET: authSecret!,
    PEY_API_KEY: peyApiKey!,
    PEY_BASE_URL: (text(raw.PEY_BASE_URL) ?? 'https://api.pey.mx').replace(
      /\/+$/,
      '',
    ),
    PEY_WEBHOOK_SECRET: webhookSecret,
    PORT: port,
    JWT_TTL: jwtTtl as Duration,
    ADMIN_USERNAME: adminUsername,
    ADMIN_PASSWORD: adminPassword,
    BUSINESS_NAME: businessName,
    EXPO_ACCESS_TOKEN: text(raw.EXPO_ACCESS_TOKEN),
    SWEEPER_ENABLED: text(raw.SWEEPER_ENABLED) !== 'false',
  };
}
