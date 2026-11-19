// Configuración leída de variables de entorno (ver .env.example).

import { normalizePhone } from './command.js';

function fail(message) {
  console.error(`${message} Revisa tu archivo .env (ver .env.example).`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`Falta la variable de entorno ${name}.`);
  return value;
}

/** "5512345678=Barbería Leo;5598765432=Tacos Ana" -> Map de teléfono a nombre del negocio. */
export function parseMerchants(value) {
  const merchants = new Map();
  for (const item of String(value ?? '').split(';')) {
    if (!item.trim()) continue;
    const [phoneText, ...nameParts] = item.split('=');
    const phone = normalizePhone(phoneText);
    const name = nameParts.join('=').trim();
    if (!phone || !name) throw new Error(`MERCHANTS: no entendí "${item.trim()}". Formato: 5512345678=Nombre del negocio`);
    merchants.set(phone, name);
  }
  return merchants;
}

const WHATSAPP_VARS = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'MERCHANTS'];

export function loadConfig({ needWebhookSecret = false } = {}) {
  const config = {
    peyApiKey: required('PEY_API_KEY'),
    peyWebhookSecret: needWebhookSecret ? required('PEY_WEBHOOK_SECRET') : process.env.PEY_WEBHOOK_SECRET,
    peyBaseUrl: process.env.PEY_BASE_URL || 'https://api.pey.mx',
    port: Number(process.env.PORT || 3000),
    databaseFile: process.env.DATABASE_FILE || 'data/cobros.db',
    // En Render, RENDER_EXTERNAL_URL trae la URL pública del servicio sin configurar nada.
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '') || null,
    trustProxy: process.env.TRUST_PROXY === 'true',
    whatsapp: null,
    demo: null,
  };

  if (config.publicBaseUrl && !config.publicBaseUrl.startsWith('https://')) {
    fail('PUBLIC_BASE_URL debe empezar con https://.');
  }

  // Demo web pública en /demo: cobros reales con monto máximo y límites por hora.
  if (process.env.DEMO_ENABLED === 'true') {
    const maxAmount = Number(process.env.DEMO_MAX_AMOUNT || '1');
    if (!Number.isFinite(maxAmount) || maxAmount <= 0) fail('DEMO_MAX_AMOUNT debe ser un monto mayor a 0.');
    config.demo = {
      merchantName: process.env.DEMO_MERCHANT_NAME || 'Negocio de prueba',
      maxAmountCents: Math.round(maxAmount * 100),
      maxChargesPerHour: Number(process.env.DEMO_MAX_CHARGES_PER_HOUR || '10'),
      maxPushesPerPayerPerHour: Number(process.env.DEMO_MAX_PUSHES_PER_PHONE_PER_HOUR || '3'),
    };
  }

  // WhatsApp es opcional (el primer cobro real no lo necesita), pero se configura completo o nada.
  const present = WHATSAPP_VARS.filter((name) => process.env[name]);
  if (present.length > 0) {
    const missing = WHATSAPP_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) fail(`Para activar WhatsApp faltan: ${missing.join(', ')}.`);
    let merchants;
    try {
      merchants = parseMerchants(process.env.MERCHANTS);
    } catch (error) {
      fail(error.message);
    }
    config.whatsapp = {
      token: process.env.WHATSAPP_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      appSecret: process.env.WHATSAPP_APP_SECRET,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v23.0',
      baseUrl: process.env.WHATSAPP_BASE_URL || undefined,
      merchants,
    };
  }

  return config;
}
