// Dobles compartidos por las pruebas: un pey y un WhatsApp simulados y un reloj que se puede mover.

import { connect } from '../src/db/connection.js';
import { migrate, TABLES } from '../src/db/schema.js';
import { createStore } from '../src/db/store.js';
import { PeyError } from '../src/pey.js';

// Una base por archivo de pruebas; se vacía antes de cada prueba. Por defecto es
// PGlite (arrancarla tarda ~1 s). Con TEST_DATABASE_URL se usa un Postgres real,
// el mismo camino que producción: `npm run test:postgres`.
let sharedDb = null;

/** Un store sobre una base recién vaciada. */
export async function freshStore({ now = Date.now } = {}) {
  if (!sharedDb) {
    sharedDb = await connect({ url: process.env.TEST_DATABASE_URL || null });
    await migrate(sharedDb);
  }
  await sharedDb.exec(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  return createStore(sharedDb, { now });
}

export const silentLog = { info() {}, warn() {}, error() {} };

export function fakeClock(start = Date.UTC(2026, 10, 13, 18, 0, 0)) {
  let current = start;
  const now = () => current;
  now.advance = (ms) => {
    current += ms;
  };
  return now;
}

/** pey simulado. `pey.fail = new PeyError(...)` hace fallar la siguiente llamada. */
export function fakePey() {
  const pey = {
    pushes: [],
    links: [],
    qrs: [],
    qrCodes: new Map(),
    bankAccounts: new Map(),
    transactions: new Map(),
    paymentLinks: new Map(),
    fail: null,

    async createPush(input) {
      pey.pushes.push(input);
      if (pey.fail) {
        const error = pey.fail;
        pey.fail = null;
        throw error;
      }
      const transactionId = `TX${pey.pushes.length}`;
      pey.transactions.set(transactionId, {
        id: transactionId,
        status: 'PENDING',
        amount: input.amount,
        metadata: { externalMetadata: { ...input.metadata } },
      });
      return { transactionId, codiId: '12345678901234567890' };
    },

    async getTransaction(id) {
      if (pey.fail) {
        const error = pey.fail;
        pey.fail = null;
        throw error;
      }
      const tx = pey.transactions.get(id);
      if (!tx) throw new PeyError('not found', { status: 404, type: 'NOT_FOUND' });
      return tx;
    },

    async createPaymentLink(input) {
      pey.links.push(input);
      if (pey.fail) {
        const error = pey.fail;
        pey.fail = null;
        throw error;
      }
      const id = `LINK${pey.links.length}`;
      pey.paymentLinks.set(id, {
        id,
        status: 'pending',
        amount: input.amount,
        clientReferenceId: input.clientReferenceId,
        transactions: [],
      });
      return { id, url: `https://app.mipey.mx/payment-link/${id}` };
    },

    async createQr(input) {
      pey.qrs.push(input);
      if (pey.fail) {
        const error = pey.fail;
        pey.fail = null;
        throw error;
      }
      const id = `IDC${pey.qrs.length}`;
      pey.qrCodes.set(id, { id, amount: input.amount, metadata: { ...input.metadata }, transactions: [] });
      return { id, qrString: `{"TYP":1,"v":"01","ic":0,"IDC":"${id}"}`, qrImage: null };
    },

    async listQrTransactions(id) {
      if (pey.fail) {
        const error = pey.fail;
        pey.fail = null;
        throw error;
      }
      const qr = pey.qrCodes.get(id);
      if (!qr) throw new PeyError('not found', { status: 404, type: 'NOT_FOUND' });
      return qr.transactions;
    },

    async registerBankAccount(input) {
      if (pey.fail) {
        const error = pey.fail;
        pey.fail = null;
        throw error;
      }
      const id = `BA${pey.bankAccounts.size + 1}`;
      pey.bankAccounts.set(id, { id, codiStatus: 'PENDING', ...input });
      return { id, codiStatus: 'PENDING' };
    },

    async getBankAccount(id) {
      const account = pey.bankAccounts.get(id);
      if (!account) throw new PeyError('not found', { status: 404, type: 'BANK_ACCOUNT_NOT_FOUND' });
      return account;
    },

    /** Simula que Banxico resolvió la cuenta. */
    setBankStatus(id, codiStatus, errorMessage) {
      Object.assign(pey.bankAccounts.get(id), { codiStatus, ...(errorMessage ? { errorMessage } : {}) });
    },

    /** Simula que el cliente escaneó y pagó el QR. Devuelve el transactionId. */
    payQr(qrId, { trackingKey = 'RASTREOQR' } = {}) {
      const qr = pey.qrCodes.get(qrId);
      const transactionId = `TXQ-${qrId}-${qr.transactions.length + 1}`;
      const tx = {
        id: transactionId,
        status: 'PAID',
        amount: qr.amount,
        amountBreakdown: { base: qr.amount },
        datePaid: 1790725000,
        metadata: { trackingKey, externalMetadata: { ...qr.metadata } },
      };
      qr.transactions.push(tx);
      pey.transactions.set(transactionId, tx);
      return transactionId;
    },

    async getPaymentLink(id) {
      const link = pey.paymentLinks.get(id);
      if (!link) throw new PeyError('not found', { status: 404, type: 'NOT_FOUND' });
      return link;
    },

    /** Simula que el cliente pagó el push. */
    pay(transactionId, { trackingKey = 'RASTREO1', datePaid = 1790724758 } = {}) {
      const tx = pey.transactions.get(transactionId);
      tx.status = 'PAID';
      tx.datePaid = datePaid;
      tx.metadata.trackingKey = trackingKey;
    },

    /** Simula que el cliente pagó la liga. */
    payLink(linkId, { tip = 0 } = {}) {
      const link = pey.paymentLinks.get(linkId);
      link.status = 'paid';
      link.transactions = [
        {
          transactionId: `TXL-${linkId}`,
          paymentMethod: 'CARD',
          datePaid: 1790724999,
          amount: link.amount + tip,
          amountBreakdown: { base: link.amount, tip, fee: 0 },
        },
      ];
    },
  };
  return pey;
}

/** WhatsApp simulado: guarda lo enviado. `whatsapp.fail = true` hace fallar el siguiente envío. */
export function fakeWhatsApp() {
  const whatsapp = {
    sent: [],
    fail: false,
    async sendText(to, body) {
      if (whatsapp.fail) {
        whatsapp.fail = false;
        throw new Error('WhatsApp caído');
      }
      whatsapp.sent.push({ to, body });
    },
    async sendImage(to, { png, caption }) {
      if (whatsapp.fail) {
        whatsapp.fail = false;
        throw new Error('WhatsApp caído');
      }
      whatsapp.sent.push({ to, body: caption, png });
    },
    last() {
      return whatsapp.sent.at(-1)?.body;
    },
  };
  return whatsapp;
}
