import { createApp } from './app.js';
import { createBot } from './bot.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createOutbox } from './outbox.js';
import { createPeyClient } from './pey.js';
import { createWhatsAppClient } from './whatsapp.js';

const SWEEP_INTERVAL_MS = 30 * 1000;

const config = loadConfig();
const db = openDb(config.databaseFile);
const pey = createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl });

// Las respuestas van a WhatsApp o a la conversación de la demo web, según a quién.
// Sin WhatsApp configurado, lo que iría a WhatsApp solo sale en la terminal.
const outbox = createOutbox({ db, whatsapp: config.whatsapp ? createWhatsAppClient(config.whatsapp) : null });

const bot = createBot({
  db,
  pey,
  outbox,
  merchants: config.whatsapp?.merchants ?? new Map(),
  publicBaseUrl: config.publicBaseUrl,
  demo: config.demo,
});

const app = createApp({
  peyWebhookSecret: config.peyWebhookSecret,
  pey,
  db,
  trustProxy: config.trustProxy,
  onPaid: async (charge) => {
    console.log(`PAGADO  $${(charge.amountCents / 100).toFixed(2)} MXN  ${charge.concept ?? ''}  (cobro ${charge.id}, ${charge.kind})`);
    await bot.notifyPaid(charge);
  },
  whatsapp: config.whatsapp && {
    appSecret: config.whatsapp.appSecret,
    verifyToken: config.whatsapp.verifyToken,
    onMessage: bot.handleMessage,
  },
  demo: config.demo && {
    onMessage: bot.handleMessage,
    merchantName: config.demo.merchantName,
    maxAmount: (config.demo.maxAmountCents / 100).toFixed(2),
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
  console.log(
    config.peyWebhookSecret
      ? 'Webhook de pey:      POST /webhooks/pey'
      : 'Webhook de pey:      sin configurar (falta PEY_WEBHOOK_SECRET); responde 503 hasta que lo agregues',
  );
  console.log(
    config.whatsapp
      ? `Webhook de WhatsApp: /webhooks/whatsapp  (${config.whatsapp.merchants.size} comerciante(s) registrados)`
      : 'WhatsApp: sin configurar (faltan las variables WHATSAPP_* y MERCHANTS)',
  );
  console.log(
    config.demo
      ? `Demo web pública:    /demo  (máximo $${(config.demo.maxAmountCents / 100).toFixed(2)} por cobro)`
      : 'Demo web: desactivada (DEMO_ENABLED=true para activarla)',
  );
  if (!config.publicBaseUrl) console.log('Ligas de pago: desactivadas (falta PUBLIC_BASE_URL)');
});
