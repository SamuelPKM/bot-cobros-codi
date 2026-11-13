// Dobles compartidos por las pruebas: un pey y un WhatsApp simulados y un reloj que se puede mover.

import { PeyError } from '../src/pey.js';

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
    last() {
      return whatsapp.sent.at(-1)?.body;
    },
  };
  return whatsapp;
}
