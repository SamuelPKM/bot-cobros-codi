// Endpoint que recibe los webhooks de pey.
//
// pey firma cada entrega con Standard Webhooks (headers webhook-id,
// webhook-timestamp y webhook-signature). Pasos, en orden:
//   1. Verificar la firma sobre el cuerpo CRUDO (los bytes exactos que llegaron).
//   2. Descartar entregas repetidas usando webhook-id.
//   3. Confirmar el pago contra la API (GET /transaction/{id}): el webhook es
//      el aviso; la API es la fuente de verdad.
//   4. Marcar el cobro como pagado una sola vez y avisar con onPaid.
// Si algo falla al procesar se responde 5xx, para que pey pueda reintentar.

import express from 'express';
import { Webhook } from 'standardwebhooks';
import { toCents } from './pey.js';

const PAYMENT_EVENTS = new Set(['codi.pn.payment_received', 'codi.qr.payment_received']);

export function createApp({ webhookSecret, pey, store, onPaid = () => {}, log = console }) {
  if (!webhookSecret) throw new Error('createApp: falta webhookSecret');
  const verifier = new Webhook(webhookSecret);
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // express.raw deja req.body como Buffer: justo lo que la firma necesita.
  app.post('/webhooks/pey', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

    let event;
    try {
      event = verifier.verify(rawBody, req.headers);
    } catch (error) {
      log.warn(`[webhook] firma rechazada: ${error.message}`);
      return res.status(401).json({ error: 'firma inválida' });
    }

    const webhookId = req.headers['webhook-id'];
    const type = event?.type;

    try {
      const recorded = store.recordEvent(webhookId, type);
      if (recorded.processedAt) {
        log.info(`[webhook] ${webhookId} repetido, ya procesado (${recorded.result})`);
        return res.json({ ok: true, duplicate: true });
      }

      const result = PAYMENT_EVENTS.has(type) ? await processPayment(event) : 'ignored';
      store.markEventProcessed(webhookId, result);
      log.info(`[webhook] ${webhookId} ${type} -> ${result}`);
      return res.json({ ok: true, result });
    } catch (error) {
      // No se marca como procesado: el reintento de pey lo volverá a intentar.
      const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
      log.error(`[webhook] ${webhookId} ${type} falló: ${error.message}${requestId}`);
      return res.status(500).json({ error: 'no se pudo procesar' });
    }
  });

  async function processPayment(event) {
    const { transactionId } = event;
    if (!transactionId) return 'missing_transaction_id';

    const tx = await pey.getTransaction(transactionId);
    if (tx.status !== 'PAID') {
      // pey avisó del pago pero la API aún no lo refleja: que reintente.
      throw new Error(`la transacción ${transactionId} está en ${tx.status}, no en PAID`);
    }

    const charge = store.getCharge(transactionId);
    const paidAmount = tx.amountBreakdown?.base ?? tx.amount;
    if (charge && toCents(charge.amount) !== toCents(paidAmount)) {
      log.warn(
        `[webhook] monto distinto en ${transactionId}: se cobró ${charge.amount} y se pagó ${paidAmount}`,
      );
      return 'amount_mismatch';
    }
    if (!charge) log.warn(`[webhook] pago de un cobro que no está en el almacén: ${transactionId}`);

    const firstTime = store.markChargePaid(transactionId, {
      amount: paidAmount,
      paidAt: tx.datePaid ?? event.datePaid,
      trackingKey: tx.metadata?.trackingKey ?? event.metadata?.trackingKey,
      concept: charge?.concept ?? event.concept,
    });
    if (!firstTime) return 'already_paid';

    await onPaid(store.getCharge(transactionId), event);
    return 'paid';
  }

  return app;
}
