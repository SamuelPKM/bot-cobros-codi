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
 * @param web Opcional: función que recibe la app y monta la web (inicio, cuentas y panel).
 * @param onBankAccountUpdated Se llama con el evento bank.account.updated; devuelve el resultado.
 * @param trustProxy Detrás de un proxy (casi cualquier hosting), para que los
 *   límites por IP vean la IP real del visitante.
 * @param onPaid Se llama con el cobro cuando queda pagado; debe avisar al comerciante.
 */
export function createApp({
  peyWebhookSecret = null,
  pey,
  peyAccounts = null, // cuentas de pey propias: cada una con su webhook en /webhooks/pey/n/<token>
  store,
  onPaid = async () => {},
  onBankAccountUpdated = async () => 'ignored',
  whatsapp = null,
  demo = null,
  web = null,
  trustProxy = false,
  now = Date.now,
  log = console,
}) {
  // Sin secreto el servidor arranca igual: el secreto solo existe después de
  // registrar la URL del webhook en pey, y para eso el servidor ya debe estar
  // publicado. Mientras tanto el webhook responde 503 y pey lo reintentará.
  const verifier = peyWebhookSecret ? new Webhook(peyWebhookSecret) : null;
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  app.get('/health', (_req, res) => res.json({ ok: true }));
  if (demo) {
    if (!web) app.get('/', (_req, res) => res.redirect('/demo'));
    mountDemo(app, {
      store,
      onMessage: demo.onMessage,
      page: { merchantName: demo.merchantName, maxAmount: demo.maxAmount },
      now,
      log,
    });
  }

  // ---------------------------------------------------------------- pey

  /**
   * Atiende un webhook de pey de una cuenta: la del proyecto (account.merchantId
   * null) o la propia de un negocio. Cada cuenta solo puede marcar pagados los
   * cobros que se crearon con su misma API key.
   */
  async function handlePey(req, res, account) {
    const tag = account.merchantId ? `[pey:${account.merchantId}]` : '[pey]';
    let event;
    try {
      event = account.verifier.verify(bodyText(req), req.headers);
    } catch (error) {
      log.warn(`${tag} firma rechazada: ${error.message}`);
      return res.status(401).json({ error: 'firma inválida' });
    }

    const source = account.merchantId ? `pey:${account.merchantId}` : 'pey';
    const webhookId = req.headers['webhook-id'];
    const type = event?.type;
    try {
      const recorded = await store.recordEvent(source, webhookId, type);
      if (recorded.processedAt) {
        log.info(`${tag} ${webhookId} repetido, ya procesado (${recorded.result})`);
        return res.json({ ok: true, duplicate: true });
      }

      let result = 'ignored';
      if (CODI_PAYMENT_EVENTS.has(type)) result = await processCodiPayment(event, account);
      else if (type === 'payment_link.status_updated') result = await processLinkUpdate(event, account);
      // Las CLABE de los negocios se registran con la API key del proyecto.
      else if (type === 'bank.account.updated' && !account.merchantId) result = await onBankAccountUpdated(event);

      await store.markEventProcessed(source, webhookId, result);
      if (account.merchantId) await peyAccounts.touch(account.merchantId);
      log.info(`${tag} ${webhookId} ${type} -> ${result}`);
      return res.json({ ok: true, result });
    } catch (error) {
      const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
      log.error(`${tag} ${webhookId} ${type} falló: ${error.message}${requestId}`);
      return res.status(500).json({ error: 'no se pudo procesar' });
    }
  }

  app.post('/webhooks/pey', rawBody, (req, res) => {
    if (!verifier) {
      log.warn('[pey] llegó un webhook pero falta PEY_WEBHOOK_SECRET: no se puede verificar');
      return res.status(503).json({ error: 'webhook de pey sin configurar' });
    }
    return handlePey(req, res, { merchantId: null, verifier, client: pey });
  });

  // Webhook de la cuenta de pey propia de un negocio. El token de la URL dice de
  // quién es; la firma, con el secreto de ese negocio, prueba que viene de pey.
  app.post('/webhooks/pey/n/:token', rawBody, async (req, res) => {
    let found;
    try {
      found = peyAccounts ? await peyAccounts.webhookFor(req.params.token) : null;
    } catch (error) {
      log.error(`[pey] no se pudo cargar la cuenta de un webhook: ${error.message}`);
      return res.status(500).json({ error: 'no se pudo procesar' });
    }
    if (!found) return res.status(404).json({ error: 'webhook desconocido' });
    return handlePey(req, res, { merchantId: found.merchantId, verifier: new Webhook(found.secret), client: found.client });
  });

  /** ¿Este cobro se creó con la API key de la cuenta que avisa? */
  const sameAccount = (charge, account) => (charge.peyMerchantId ?? null) === (account.merchantId ?? null);

  /** Pago de un push o de un QR. El webhook es el aviso; la API es la fuente de verdad. */
  async function processCodiPayment(event, account) {
    const { transactionId } = event;
    if (!transactionId) return 'missing_transaction_id';

    const tx = await account.client.getTransaction(transactionId);
    if (tx.status !== 'PAID') {
      throw new Error(`la transacción ${transactionId} está en ${tx.status}, no en PAID`);
    }

    const isQr = event.type === 'codi.qr.payment_received';
    const chargeId = tx.metadata?.externalMetadata?.chargeId ?? event.metadata?.externalMetadata?.chargeId;
    const charge =
      (await store.getChargeByTransactionId(transactionId)) ??
      (isQr && event.codiQrId ? await store.getChargeByQrId(event.codiQrId) : null) ??
      (chargeId ? await store.getCharge(Number(chargeId)) : null);
    if (!charge) {
      log.warn(`[pey] pago de un cobro que no está en la base de datos: ${transactionId}`);
      return 'unknown_charge';
    }
    if (!sameAccount(charge, account)) {
      log.warn(`[pey] el pago ${transactionId} llegó por otra cuenta de pey que la del cobro ${charge.id}: se ignora`);
      return 'other_account';
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

    const firstTime = await store.markPaid(charge.id, {
      paidAt: tx.datePaid ?? event.datePaid,
      trackingKey: tx.metadata?.trackingKey ?? event.metadata?.trackingKey ?? null,
      paidVia: isQr ? 'qr' : 'push',
      transactionId,
    });
    await onPaid(await store.getCharge(charge.id));
    return firstTime ? 'paid' : 'already_paid';
  }

  /** Cambio de estado de una liga de pago (plan B). */
  async function processLinkUpdate(event, account) {
    if (event.status !== 'paid') return `link_${event.status ?? 'unknown'}`;
    if (!event.paymentLinkId) return 'missing_link_id';

    const link = await account.client.getPaymentLink(event.paymentLinkId);
    if (link.status !== 'paid') {
      throw new Error(`la liga ${event.paymentLinkId} está en ${link.status}, no en paid`);
    }

    const reference = /^cobro-(\d+)$/.exec(link.clientReferenceId ?? '');
    const charge =
      (await store.getChargeByLinkId(event.paymentLinkId)) ?? (reference ? await store.getCharge(Number(reference[1])) : null);
    if (!charge) {
      log.warn(`[pey] liga pagada que no está en la base de datos: ${event.paymentLinkId}`);
      return 'unknown_charge';
    }
    if (!sameAccount(charge, account)) {
      log.warn(`[pey] la liga ${event.paymentLinkId} llegó por otra cuenta de pey que la del cobro ${charge.id}: se ignora`);
      return 'other_account';
    }

    // Lo que cuenta contra el cobro es la base; la propina y la comisión van aparte.
    const transactions = link.transactions ?? [];
    const paidCents = transactions.reduce((sum, t) => sum + toCents(t.amountBreakdown?.base ?? t.amount), 0);
    if (paidCents !== charge.amountCents) {
      log.warn(`[pey] monto distinto en la liga del cobro ${charge.id}: se cobró ${charge.amountCents} y se pagó ${paidCents} (centavos)`);
      return 'amount_mismatch';
    }

    const last = transactions.at(-1);
    const firstTime = await store.markPaid(charge.id, {
      paidAt: last?.datePaid,
      trackingKey: last?.metadata?.trackingKey ?? null,
      paidVia: 'link',
    });
    await onPaid(await store.getCharge(charge.id));
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
        if (!(await store.claimMessage('whatsapp', message.id))) {
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

  // La web va al final: las rutas de arriba (webhooks, demo) no pasan por sus
  // sesiones ni cabeceras.
  if (web) web(app);

  return app;
}
