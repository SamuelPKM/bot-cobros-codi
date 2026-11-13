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
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') || null,
    whatsapp: null,
  };

  if (config.publicBaseUrl && !config.publicBaseUrl.startsWith('https://')) {
    fail('PUBLIC_BASE_URL debe empezar con https://.');
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
