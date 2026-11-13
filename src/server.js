import { loadConfig } from './config.js';
import { createPeyClient } from './pey.js';
import { createFileStore } from './store.js';
import { createApp } from './webhook.js';

const config = loadConfig({ needWebhookSecret: true });

const app = createApp({
  webhookSecret: config.peyWebhookSecret,
  pey: createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl }),
  store: createFileStore(config.dataFile),
  // Aquí irá el aviso "Pagado" por WhatsApp al comerciante.
  onPaid: (charge) => {
    console.log(`PAGADO  $${Number(charge.amount).toFixed(2)} MXN  ${charge.concept ?? ''}  (${charge.transactionId})`);
  },
});

app.listen(config.port, () => {
  console.log(`Escuchando en http://localhost:${config.port}`);
  console.log(`Webhook de pey: POST /webhooks/pey  (regístralo en el portal con tu URL pública HTTPS)`);
});
