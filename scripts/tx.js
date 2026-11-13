// Consulta el estado de una transacción en pey.
//
//   npm run tx -- <transactionId>

import { loadConfig } from '../src/config.js';
import { createPeyClient, PeyError } from '../src/pey.js';

const [transactionId] = process.argv.slice(2);
if (!transactionId) {
  console.error('Uso: npm run tx -- <transactionId>');
  process.exit(1);
}

const config = loadConfig();
const pey = createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl });

try {
  const tx = await pey.getTransaction(transactionId);
  console.log(`${tx.status}  $${Number(tx.amount).toFixed(2)} ${tx.currency ?? 'MXN'}  ${tx.description ?? ''}`);
  if (tx.datePaid) console.log(`  pagado: ${new Date(tx.datePaid * 1000).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
  if (tx.metadata?.trackingKey) console.log(`  clave de rastreo: ${tx.metadata.trackingKey}`);
} catch (error) {
  if (!(error instanceof PeyError)) throw error;
  console.error(`No se pudo consultar: ${error.message} (${error.type})`);
  if (error.requestId) console.error(`  requestId: ${error.requestId}`);
  process.exit(1);
}
