import { createApp } from './app.js';
import { createBot } from './bot.js';
import { createCharges } from './charges.js';
import { loadConfig } from './config.js';
import { connect } from './db/connection.js';
import { migrate } from './db/schema.js';
import { createStore } from './db/store.js';
import { createOutbox } from './outbox.js';
import { createPeyClient } from './pey.js';
import { createSweeper } from './sweeper.js';
import { hashPassword } from './web/auth.js';
import { mountWeb } from './web/routes.js';
import { createWhatsAppClient } from './whatsapp.js';

const config = loadConfig();
const db = await connect({ url: config.databaseUrl, dataDir: config.databaseDir });
await migrate(db);
const store = createStore(db);
const pey = createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl });

// Las respuestas van a WhatsApp o a la conversación de la demo web, según a quién.
// Sin WhatsApp configurado, lo que iría a WhatsApp solo sale en la terminal.
const outbox = createOutbox({ store, whatsapp: config.whatsapp ? createWhatsAppClient(config.whatsapp) : null });

// Barrido de cobros vencidos, avisos pendientes y CLABEs en validación. Se agenda
// solo cuando hace falta, para que una base serverless pueda dormir.
let sweeper = null;
const charges = createCharges({
  store,
  pey,
  outbox,
  limits: config.limits,
  publicBaseUrl: config.publicBaseUrl,
  onActivity: () => sweeper?.poke(),
});
sweeper = createSweeper({ sweep: charges.sweep, hints: store.sweepHints });
const bot = createBot({ store, charges, outbox, demo: config.demo, webUrl: config.publicBaseUrl });

// Cuenta de demostración para el jurado (siempre en modo prueba).
if (config.web.demoAccount) {
  const { email, password } = config.web.demoAccount;
  const existing = await store.getMerchantByEmail(email);
  const passwordHash = await hashPassword(password);
  if (existing) await store.updateMerchant(existing.id, { passwordHash, isDemo: true });
  else await store.createMerchant({ email, passwordHash, businessName: config.web.demoMerchantName, isDemo: true });
}

const app = createApp({
  peyWebhookSecret: config.peyWebhookSecret,
  pey,
  store,
  trustProxy: config.trustProxy,
  onPaid: async (charge) => {
    console.log(`PAGADO  $${(charge.amountCents / 100).toFixed(2)} MXN  ${charge.concept ?? ''}  (cobro ${charge.id}, ${charge.kind})`);
    await charges.notifyPaid(charge);
  },
  onBankAccountUpdated: charges.handleBankAccountUpdated,
  whatsapp: config.whatsapp && {
    appSecret: config.whatsapp.appSecret,
    verifyToken: config.whatsapp.verifyToken,
    onMessage: bot.handleMessage,
  },
  demo: config.demo && {
    onMessage: bot.handleMessage,
    merchantName: config.demo.merchantName,
    maxAmount: (config.limits.maxAmountCents / 100).toFixed(2),
  },
  web: (target) =>
    mountWeb(target, {
      store,
      charges,
      limits: config.limits,
      publicBaseUrl: config.publicBaseUrl,
      registrationOpen: config.web.registrationOpen,
      trustedEmails: config.web.trustedEmails,
      whatsappNumber: config.whatsapp?.displayNumber ?? null,
      demoEnabled: Boolean(config.demo),
      secureCookies: Boolean(config.publicBaseUrl?.startsWith('https://')),
    }),
});

// Con varias instancias, el candado de la base hace que el barrido corra en una sola.
sweeper.start();

const server = app.listen(config.port, () => {
  console.log(`Escuchando en http://localhost:${config.port}`);
  console.log(`Base de datos:       ${db.engine === 'postgres' ? 'Postgres (DATABASE_URL)' : `PGlite en ${config.databaseDir} (sin DATABASE_URL)`}`);
  console.log(`Web:                 ${config.publicBaseUrl ?? `http://localhost:${config.port}`}`);
  console.log(
    config.peyWebhookSecret
      ? 'Webhook de pey:      POST /webhooks/pey'
      : 'Webhook de pey:      sin configurar (falta PEY_WEBHOOK_SECRET); responde 503 hasta que lo agregues',
  );
  console.log(config.whatsapp ? 'Webhook de WhatsApp: /webhooks/whatsapp' : 'WhatsApp:            sin configurar (faltan las variables WHATSAPP_*)');
  console.log(config.demo ? `Demo web pública:    /demo  (máximo $${(config.limits.maxAmountCents / 100).toFixed(2)} por cobro)` : 'Demo web:            desactivada (DEMO_ENABLED=true para activarla)');
  if (!config.publicBaseUrl) console.log('Ligas de pago:       desactivadas (falta PUBLIC_BASE_URL)');
});

// Al apagar (por ejemplo en un despliegue), se cierran las conexiones limpio.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    sweeper.stop();
    server.close(() => db.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
