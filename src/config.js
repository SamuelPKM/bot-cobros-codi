// Configuración leída de variables de entorno (ver .env.example).

function fail(message) {
  console.error(`${message} Revisa tus variables de entorno (ver .env.example).`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`Falta la variable de entorno ${name}.`);
  return value;
}

const list = (value) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const WHATSAPP_VARS = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'];

export function loadConfig() {
  const config = {
    peyApiKey: required('PEY_API_KEY'),
    peyWebhookSecret: process.env.PEY_WEBHOOK_SECRET || null,
    peyBaseUrl: process.env.PEY_BASE_URL || 'https://api.pey.mx',
    // Llave para cifrar las API keys de pey que conectan los negocios. Sin ella
    // no se pueden conectar cuentas propias (todo lo demás funciona igual).
    secretsKey: process.env.SECRETS_KEY || null,
    port: Number(process.env.PORT || 3000),

    // Con DATABASE_URL se usa Postgres (por ejemplo Neon). Sin ella, PGlite
    // guarda en DATABASE_DIR: sirve para desarrollo, no para varias instancias.
    databaseUrl: process.env.DATABASE_URL || null,
    databaseDir: process.env.DATABASE_DIR || 'data/pglite',

    // En Render, RENDER_EXTERNAL_URL trae la URL pública del servicio sin configurar nada.
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '') || null,
    trustProxy: process.env.TRUST_PROXY === 'true',

    // Modo prueba: aplica a la demo y a los comerciantes sin CLABE propia activa.
    limits: {
      maxAmountCents: 0,
      maxChargesPerHour: Number(process.env.DEMO_MAX_CHARGES_PER_HOUR || '10'),
      maxPushesPerPayerPerHour: Number(process.env.DEMO_MAX_PUSHES_PER_PHONE_PER_HOUR || '3'),
    },

    web: {
      registrationOpen: process.env.REGISTRATION_OPEN !== 'false',
      // Cuentas que cobran sin el límite del modo prueba aunque no tengan CLABE propia
      // (por ejemplo, la del equipo). Sus cobros llegan a la cuenta de la API key.
      trustedEmails: list(process.env.TRUSTED_EMAILS),
      // Cuenta de demostración para el jurado, que se crea o actualiza al arrancar.
      demoAccount:
        process.env.DEMO_ACCOUNT_EMAIL && process.env.DEMO_ACCOUNT_PASSWORD
          ? { email: process.env.DEMO_ACCOUNT_EMAIL, password: process.env.DEMO_ACCOUNT_PASSWORD }
          : null,
    },

    demo: null,
    whatsapp: null,
  };

  if (config.secretsKey && config.secretsKey.length < 32) fail('SECRETS_KEY debe tener al menos 32 caracteres.');

  if (config.publicBaseUrl && !config.publicBaseUrl.startsWith('https://')) {
    fail('PUBLIC_BASE_URL debe empezar con https://.');
  }

  const maxAmount = Number(process.env.DEMO_MAX_AMOUNT || '1');
  if (!Number.isFinite(maxAmount) || maxAmount <= 0) fail('DEMO_MAX_AMOUNT debe ser un monto mayor a 0.');
  config.limits.maxAmountCents = Math.round(maxAmount * 100);
  const demoName = process.env.DEMO_MERCHANT_NAME || 'Negocio de prueba';

  // Demo web pública en /demo: el chat del bot, en modo prueba.
  if (process.env.DEMO_ENABLED === 'true') config.demo = { merchantName: demoName };
  config.web.demoMerchantName = demoName;

  // WhatsApp es opcional, pero se configura completo o nada.
  const present = WHATSAPP_VARS.filter((name) => process.env[name]);
  if (present.length > 0) {
    const missing = WHATSAPP_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) fail(`Para activar WhatsApp faltan: ${missing.join(', ')}.`);
    config.whatsapp = {
      token: process.env.WHATSAPP_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      appSecret: process.env.WHATSAPP_APP_SECRET,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v23.0',
      baseUrl: process.env.WHATSAPP_BASE_URL || undefined,
      // El número del bot, para mostrarlo en la web al ligar un WhatsApp (por ejemplo "55 1234 5678").
      displayNumber: process.env.WHATSAPP_DISPLAY_NUMBER || null,
    };
  }

  return config;
}
