// Servidor HTTP: los webhooks de pey y de WhatsApp.
//
// Los dos verifican la firma sobre el cuerpo CRUDO (los bytes exactos que
// llegaron), pero tratan distinto las entregas repetidas:
//
//  - pey (pagos): "al menos una vez". Si algo falla se responde 5xx y el evento
//    queda sin procesar, para que el reintento de pey lo vuelva a intentar.
//    Marcar un cobro como pagado es idempotente, así que repetir no hace daño.
//
//  - WhatsApp (mensajes del comerciante): "a lo mucho una vez". El mensaje se
//    reclama ANTES de ejecutarlo y nunca se repite, porque repetir un "sí"
//    podría mandar dos cobros al mismo cliente.

import express from 'express';
import { Webhook } from 'standardwebhooks';
import { mountDemo } from './demo.js';
import { toCents } from './pey.js';
import { extractMessages, verifyMetaSignature } from './whatsapp.js';

const CODI_PAYMENT_EVENTS = new Set(['codi.pn.payment_received', 'codi.qr.payment_received']);
const rawBody = express.raw({ type: () => true, limit: '1mb' });
const bodyText = (req) => (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '');

/**
 * @param whatsapp Opcional: { appSecret, verifyToken, onMessage }. Sin él solo
 *   se monta el webhook de pey (suficiente para el primer cobro real).
 * @param demo Opcional: { onMessage, merchantName, maxAmount }. Monta la demo web pública en /demo.
 * @param trustProxy Detrás de un proxy (casi cualquier hosting), para que los
 *   límites por IP vean la IP real del visitante.
 * @param onPaid Se llama con el cobro cuando queda pagado; debe avisar al comerciante.
 */
export function createApp({
  peyWebhookSecret,
  pey,
  db,
  onPaid = async () => {},
  whatsapp = null,
  demo = null,
  trustProxy = false,
  now = Date.now,
  log = console,
}) {
  if (!peyWebhookSecret) throw new Error('createApp: falta peyWebhookSecret');
  const verifier = new Webhook(peyWebhookSecret);
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  app.get('/health', (_req, res) => res.json({ ok: true }));
  if (demo) {
    app.get('/', (_req, res) => res.redirect('/demo'));
    mountDemo(app, {
      db,
      onMessage: demo.onMessage,
      page: { merchantName: demo.merchantName, maxAmount: demo.maxAmount },
      now,
      log,
    });
  }

  // ---------------------------------------------------------------- pey

  app.post('/webhooks/pey', rawBody, async (req, res) => {
    let event;
    try {
      event = verifier.verify(bodyText(req), req.headers);
    } catch (error) {
      log.warn(`[pey] firma rechazada: ${error.message}`);
      return res.status(401).json({ error: 'firma inválida' });
    }

    const webhookId = req.headers['webhook-id'];
    const type = event?.type;
    try {
      const recorded = db.recordEvent('pey', webhookId, type);
      if (recorded.processedAt) {
        log.info(`[pey] ${webhookId} repetido, ya procesado (${recorded.result})`);
        return res.json({ ok: true, duplicate: true });
      }

      let result = 'ignored';
      if (CODI_PAYMENT_EVENTS.has(type)) result = await processCodiPayment(event);
      else if (type === 'payment_link.status_updated') result = await processLinkUpdate(event);

      db.markEventProcessed('pey', webhookId, result);
      log.info(`[pey] ${webhookId} ${type} -> ${result}`);
      return res.json({ ok: true, result });
    } catch (error) {
      const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
      log.error(`[pey] ${webhookId} ${type} falló: ${error.message}${requestId}`);
      return res.status(500).json({ error: 'no se pudo procesar' });
    }
  });

  /** Pago de un push o de un QR. El webhook es el aviso; la API es la fuente de verdad. */
  async function processCodiPayment(event) {
    const { transactionId } = event;
    if (!transactionId) return 'missing_transaction_id';

    const tx = await pey.getTransaction(transactionId);
    if (tx.status !== 'PAID') {
      throw new Error(`la transacción ${transactionId} está en ${tx.status}, no en PAID`);
    }

    const isQr = event.type === 'codi.qr.payment_received';
    const chargeId = tx.metadata?.externalMetadata?.chargeId ?? event.metadata?.externalMetadata?.chargeId;
    const charge =
      db.getChargeByTransactionId(transactionId) ??
      (isQr && event.codiQrId ? db.getChargeByQrId(event.codiQrId) : null) ??
      (chargeId ? db.getCharge(Number(chargeId)) : null);
    if (!charge) {
      log.warn(`[pey] pago de un cobro que no está en la base de datos: ${transactionId}`);
      return 'unknown_charge';
    }

    const paidCents = toCents(tx.amountBreakdown?.base ?? tx.amount);
    if (paidCents !== charge.amountCents) {
      log.warn(`[pey] monto distinto en el cobro ${charge.id}: se cobró ${charge.amountCents} y se pagó ${paidCents} (centavos)`);
      return 'amount_mismatch';
    }

    if (charge.status === 'paid' && charge.transactionId && charge.transactionId !== transactionId) {
      // Un QR puede recibir más de un pago mientras está vigente: es un pago de más, hay que aclararlo.
      log.warn(`[pey] el cobro ${charge.id} ya estaba pagado y llegó otro pago (${transactionId}): revisar devolución`);
      return 'extra_payment';
    }

    const firstTime = db.markPaid(charge.id, {
      paidAt: tx.datePaid ?? event.datePaid,
      trackingKey: tx.metadata?.trackingKey ?? event.metadata?.trackingKey ?? null,
      paidVia: isQr ? 'qr' : 'push',
      transactionId,
    });
    await onPaid(db.getCharge(charge.id));
    return firstTime ? 'paid' : 'already_paid';
  }

  /** Cambio de estado de una liga de pago (plan B). */
  async function processLinkUpdate(event) {
    if (event.status !== 'paid') return `link_${event.status ?? 'unknown'}`;
    if (!event.paymentLinkId) return 'missing_link_id';

    const link = await pey.getPaymentLink(event.paymentLinkId);
    if (link.status !== 'paid') {
      throw new Error(`la liga ${event.paymentLinkId} está en ${link.status}, no en paid`);
    }

    const reference = /^cobro-(\d+)$/.exec(link.clientReferenceId ?? '');
    const charge = db.getChargeByLinkId(event.paymentLinkId) ?? (reference ? db.getCharge(Number(reference[1])) : null);
    if (!charge) {
      log.warn(`[pey] liga pagada que no está en la base de datos: ${event.paymentLinkId}`);
      return 'unknown_charge';
    }

    // Lo que cuenta contra el cobro es la base; la propina y la comisión van aparte.
    const transactions = link.transactions ?? [];
    const paidCents = transactions.reduce((sum, t) => sum + toCents(t.amountBreakdown?.base ?? t.amount), 0);
    if (paidCents !== charge.amountCents) {
      log.warn(`[pey] monto distinto en la liga del cobro ${charge.id}: se cobró ${charge.amountCents} y se pagó ${paidCents} (centavos)`);
      return 'amount_mismatch';
    }

    const last = transactions.at(-1);
    const firstTime = db.markPaid(charge.id, {
      paidAt: last?.datePaid,
      trackingKey: last?.metadata?.trackingKey ?? null,
      paidVia: 'link',
    });
    await onPaid(db.getCharge(charge.id));
    return firstTime ? 'paid' : 'already_paid';
  }

  // Páginas a las que pey regresa al cliente después de una liga de pago.
  // El regreso NO prueba el pago, así que no se afirma que ya se pagó.
  const page = (title, text) =>
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center">` +
    `<h1>${title}</h1><p>${text}</p></body></html>`;
  app.get('/pago/gracias', (_req, res) =>
    res.type('html').send(page('Gracias', 'Estamos confirmando tu pago. El negocio recibirá el aviso en cuanto se acredite. Ya puedes cerrar esta página.')),
  );
  app.get('/pago/cancelado', (_req, res) =>
    res.type('html').send(page('Pago sin completar', 'No se realizó ningún cargo. Si quieres pagar, vuelve a abrir la liga que te mandaron.')),
  );

  // ----------------------------------------------------------- WhatsApp

  if (whatsapp) {
    const { appSecret, verifyToken, onMessage } = whatsapp;
    if (!appSecret || !verifyToken || !onMessage) {
      throw new Error('createApp: whatsapp necesita appSecret, verifyToken y onMessage');
    }

    // Meta llama este GET una vez, al registrar el webhook, para comprobar que es nuestro.
    app.get('/webhooks/whatsapp', (req, res) => {
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
      if (mode === 'subscribe' && token === verifyToken) return res.type('text').send(String(challenge ?? ''));
      return res.sendStatus(403);
    });

    app.post('/webhooks/whatsapp', rawBody, async (req, res) => {
      if (!verifyMetaSignature(req.body ?? Buffer.alloc(0), req.headers['x-hub-signature-256'], appSecret)) {
        log.warn('[whatsapp] firma rechazada');
        return res.sendStatus(401);
      }

      let messages;
      try {
        messages = extractMessages(JSON.parse(bodyText(req)));
      } catch {
        return res.sendStatus(400);
      }

      // Se responde 200 pase lo que pase: un error al atender un mensaje se
      // registra, pero no se le pide a Meta que lo reenvíe.
      for (const message of messages) {
        if (!db.claimMessage('whatsapp', message.id)) {
          log.info(`[whatsapp] ${message.id} repetido, se ignora`);
          continue;
        }
        try {
          await onMessage(message);
        } catch (error) {
          log.error(`[whatsapp] ${message.id} falló: ${error.message}`);
        }
      }
      return res.sendStatus(200);
    });
  }

  return app;
}
