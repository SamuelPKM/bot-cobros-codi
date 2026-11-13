// Manda un cobro CoDi por notificación push.
//
//   npm run push -- <teléfono de 10 dígitos> [monto] [concepto]
//   npm run push -- 5512345678                    -> cobra $0.01
//   npm run push -- 5512345678 150 "Corte de pelo"
//
// OJO: es un cobro REAL. No hay sandbox; se prueba en producción con $0.01.

import { loadConfig } from '../src/config.js';
import { createPeyClient, MIN_EXPIRATION_SECONDS, PeyError } from '../src/pey.js';
import { createFileStore } from '../src/store.js';

const [phoneNumber, amountArg = '0.01', concept = 'Prueba bot de cobros'] = process.argv.slice(2);

if (!phoneNumber) {
  console.error('Uso: npm run push -- <teléfono de 10 dígitos> [monto] [concepto]');
  process.exit(1);
}

const amount = Number(amountArg);
const config = loadConfig();
const pey = createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl });
const store = createFileStore(config.dataFile);

try {
  const { transactionId, codiId } = await pey.createPush({
    amount,
    phoneNumber,
    concept,
    expiration: MIN_EXPIRATION_SECONDS,
  });
  store.saveCharge({ transactionId, codiId, amount, phoneNumber, concept });

  console.log(`Push enviado: $${amount.toFixed(2)} MXN al ${phoneNumber}`);
  console.log(`  transactionId: ${transactionId}`);
  console.log(`  codiId:        ${codiId}`);
  console.log(`Tienes ${MIN_EXPIRATION_SECONDS / 60} minutos para aprobarlo en la app de tu banco.`);
  console.log(`Para consultar el estado: npm run tx -- ${transactionId}`);
} catch (error) {
  if (!(error instanceof PeyError)) throw error;
  console.error(`No se pudo enviar el push: ${error.message}`);
  console.error(`  tipo: ${error.type}${error.status ? `  HTTP ${error.status}` : ''}`);
  if (error.requestId) console.error(`  requestId: ${error.requestId}  (dáselo a soporte de pey)`);
  if (error.type === 'TIMEOUT' || error.type === 'NETWORK_ERROR') {
    console.error('  No lo reintentes a ciegas: el push pudo haberse enviado. Revisa primero tu celular.');
  }
  process.exit(1);
}
