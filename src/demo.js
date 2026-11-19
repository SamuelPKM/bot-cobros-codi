// Demo web pública: la misma conversación del bot, en una página que cualquiera
// puede abrir sin invitación (lo que piden las reglas del hackatón para la
// "Demo Pública"). Los cobros son reales, así que todo tiene límites.
//
//   GET  /demo                    la página
//   POST /demo/api/session        crea una sesión -> { sessionId }
//   GET  /demo/api/messages       mensajes nuevos de la sesión (?after=<id>)
//   POST /demo/api/messages       manda un mensaje { text, after } -> mensajes nuevos
//
// La sesión viaja en el header X-Demo-Session.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';

const PAGE = readFileSync(new URL('./demo-page.html', import.meta.url), 'utf8');
const SESSION_ID = /^[a-f0-9]{32}$/;
const MAX_TEXT_LENGTH = 300;
const HOUR_MS = 60 * 60 * 1000;

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * @param page Variables que se insertan en la página: { merchantName, maxAmount }.
 */
export function mountDemo(app, { store, onMessage, page, now = Date.now, log = console }) {
  const html = PAGE.replaceAll('{{MERCHANT_NAME}}', escapeHtml(page.merchantName)).replaceAll(
    '{{MAX_AMOUNT}}',
    escapeHtml(page.maxAmount),
  );
  // Los límites viven en la base, para que valgan igual con varias instancias.
  const allowMessage = async (session, ip) =>
    (await store.hit(`demo-msg:${session}`, { limit: 30, windowMs: TEN_MINUTES })) &&
    (await store.hit(`demo-msg-ip:${ip}`, { limit: 120, windowMs: TEN_MINUTES }));
  const json = express.json({ limit: '4kb' });

  app.get('/demo', (_req, res) => {
    res
      .set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('Referrer-Policy', 'no-referrer')
      .type('html')
      .send(html);
  });

  app.post('/demo/api/session', async (req, res) => {
    if ((await store.countDemoSessionsByIp(req.ip, now() - HOUR_MS)) >= 20) {
      return res.status(429).json({ error: 'Demasiadas sesiones nuevas desde esta conexión. Intenta en una hora.' });
    }
    const sessionId = randomBytes(16).toString('hex');
    await store.createDemoSession(sessionId, req.ip);
    await store.addDemoMessage(sessionId, 'bot', { body: welcome(page) });
    return res.status(201).json({ sessionId });
  });

  async function session(req, res) {
    const id = req.get('x-demo-session');
    if (!id || !SESSION_ID.test(id) || !(await store.demoSessionExists(id))) {
      res.status(401).json({ error: 'Sesión de demo inválida. Recarga la página.' });
      return null;
    }
    return id;
  }

  const after = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };

  const present = (messages) =>
    messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      image: m.imagePng ? `data:image/png;base64,${m.imagePng}` : null,
    }));

  app.get('/demo/api/messages', async (req, res) => {
    const id = await session(req, res);
    if (!id) return undefined;
    return res
      .set('Cache-Control', 'no-store')
      .json({ messages: present(await store.listDemoMessages(id, after(req.query.after))) });
  });

  app.post('/demo/api/messages', json, async (req, res) => {
    const id = await session(req, res);
    if (!id) return undefined;

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Escribe un mensaje.' });
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `El mensaje puede tener hasta ${MAX_TEXT_LENGTH} caracteres.` });
    }
    if (!(await allowMessage(id, req.ip))) {
      return res.status(429).json({ error: 'Vas muy rápido. Espera unos minutos.' });
    }

    await store.addDemoMessage(id, 'user', { body: text });
    try {
      await onMessage({ from: `demo:${id}`, text });
    } catch (error) {
      log.error(`[demo] ${id} falló: ${error.message}`);
      await store.addDemoMessage(id, 'bot', { body: 'Algo salió mal de mi lado. Intenta de nuevo en un momento.' });
    }
    return res
      .set('Cache-Control', 'no-store')
      .json({ messages: present(await store.listDemoMessages(id, after(req.body?.after))) });
  });
}

function welcome({ merchantName, maxAmount }) {
  return [
    `Hola, soy *Cóbrale*. En esta demo eres *${merchantName}* y yo te ayudo a cobrar con CoDi.`,
    '',
    'Prueba cualquiera de estas:',
    '• *cobra 0.01 a <tu celular> prueba*: te llega la solicitud de pago a la app de tu banco.',
    '• *qr 0.01 prueba*: te doy un QR para escanear.',
    '• *liga 0.01 prueba*: te doy una liga de pago.',
    '',
    `Los cobros son reales y el máximo es de $${maxAmount}. En cuanto pagues te aviso aquí.`,
  ].join('\n');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
