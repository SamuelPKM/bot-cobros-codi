import { createApp } from './app.js';
import { createBot } from './bot.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createPeyClient } from './pey.js';
import { createWhatsAppClient } from './whatsapp.js';

const SWEEP_INTERVAL_MS = 30 * 1000;

const config = loadConfig({ needWebhookSecret: true });
const db = openDb(config.databaseFile);
const pey = createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl });

// Sin WhatsApp configurado, los avisos solo salen en la terminal.
const whatsappClient = config.whatsapp
  ? createWhatsAppClient(config.whatsapp)
  : { sendText: async (to, body) => console.log(`[sin WhatsApp] para ${to}:\n${body}`) };

const bot = createBot({
  db,
  pey,
  whatsapp: whatsappClient,
  merchants: config.whatsapp?.merchants ?? new Map(),
  publicBaseUrl: config.publicBaseUrl,
});

const app = createApp({
  peyWebhookSecret: config.peyWebhookSecret,
  pey,
  db,
  onPaid: async (charge) => {
    console.log(`PAGADO  $${(charge.amountCents / 100).toFixed(2)} MXN  ${charge.concept ?? ''}  (cobro ${charge.id})`);
    await bot.notifyPaid(charge);
  },
  whatsapp: config.whatsapp && {
    appSecret: config.whatsapp.appSecret,
    verifyToken: config.whatsapp.verifyToken,
    onMessage: bot.handleMessage,
  },
});

// Expira los cobros vencidos y reintenta avisos pendientes.
let sweeping = false;
setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    await bot.sweep();
  } catch (error) {
    console.error(`[barrido] ${error.message}`);
  } finally {
    sweeping = false;
  }
}, SWEEP_INTERVAL_MS).unref();

app.listen(config.port, () => {
  console.log(`Escuchando en http://localhost:${config.port}`);
  console.log('Webhook de pey:      POST /webhooks/pey');
  console.log(
    config.whatsapp
      ? `Webhook de WhatsApp: /webhooks/whatsapp  (${config.whatsapp.merchants.size} comerciante(s) registrados)`
      : 'WhatsApp: sin configurar (faltan las variables WHATSAPP_* y MERCHANTS)',
  );
  if (!config.publicBaseUrl) console.log('Ligas de pago: desactivadas (falta PUBLIC_BASE_URL)');
});
