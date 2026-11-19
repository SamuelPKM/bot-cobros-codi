// Manda un cobro CoDi por notificación push, sin pasar por WhatsApp.
//
//   npm run push -- <teléfono de 10 dígitos> [monto] [concepto]
//   npm run push -- 5512345678                    -> cobra $0.01
//   npm run push -- 5512345678 150 "Corte de pelo"
//
// OJO: es un cobro REAL. No hay sandbox; se prueba en producción con $0.01.

import { normalizePhone } from '../src/command.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createPeyClient, MIN_EXPIRATION_SECONDS, PeyError, toCents } from '../src/pey.js';

const [phoneArg, amountArg = '0.01', concept = 'Prueba Cóbrale'] = process.argv.slice(2);
const phoneNumber = normalizePhone(phoneArg);
const amount = Number(amountArg);

if (!phoneNumber || !Number.isFinite(amount) || amount <= 0) {
  console.error('Uso: npm run push -- <teléfono de 10 dígitos> [monto] [concepto]');
  process.exit(1);
}

const config = loadConfig();
const pey = createPeyClient({ apiKey: config.peyApiKey, baseUrl: config.peyBaseUrl });
const db = openDb(config.databaseFile);

const charge = db.createCharge({ payerPhone: phoneNumber, amountCents: toCents(amount), concept, status: 'sending' });

try {
  const { transactionId, codiId } = await pey.createPush({
    amount,
    phoneNumber,
    concept,
    expiration: MIN_EXPIRATION_SECONDS,
    numRef: String(charge.id % 10_000_000),
    metadata: { chargeId: String(charge.id) },
  });
  db.updateCharge(charge.id, {
    status: 'pending',
    transactionId,
    codiId,
    expiresAt: Date.now() + MIN_EXPIRATION_SECONDS * 1000,
  });

  console.log(`Push enviado: $${amount.toFixed(2)} MXN al ${phoneNumber}  (cobro ${charge.id})`);
  console.log(`  transactionId: ${transactionId}`);
  console.log(`  codiId:        ${codiId}`);
  console.log(`Tienes ${MIN_EXPIRATION_SECONDS / 60} minutos para aprobarlo en la app de tu banco.`);
  console.log(`Para consultar el estado: npm run tx -- ${transactionId}`);
} catch (error) {
  if (!(error instanceof PeyError)) throw error;
  const uncertain = error.type === 'TIMEOUT' || error.type === 'NETWORK_ERROR';
  db.updateCharge(charge.id, {
    status: uncertain ? 'unknown' : 'failed',
    error: error.message,
    expiresAt: uncertain ? Date.now() + MIN_EXPIRATION_SECONDS * 1000 : null,
  });

  console.error(`No se pudo enviar el push: ${error.message}`);
  console.error(`  tipo: ${error.type}${error.status ? `  HTTP ${error.status}` : ''}`);
  if (error.requestId) console.error(`  requestId: ${error.requestId}  (dáselo a soporte de pey)`);
  if (uncertain) console.error('  No lo reintentes a ciegas: el push pudo haberse enviado. Revisa primero tu celular.');
  process.exit(1);
}
