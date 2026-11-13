// WhatsApp Cloud API (Meta): enviar mensajes de texto y leer los webhooks entrantes.

import { createHmac, timingSafeEqual } from 'node:crypto';

export class WhatsAppError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'WhatsAppError';
    this.status = status;
    this.code = code;
  }
}

export function createWhatsAppClient({
  token,
  phoneNumberId,
  apiVersion = 'v23.0',
  baseUrl = 'https://graph.facebook.com',
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  if (!token) throw new Error('createWhatsAppClient: falta token');
  if (!phoneNumberId) throw new Error('createWhatsAppClient: falta phoneNumberId');

  return {
    /** Manda un mensaje de texto. `to` es el número en formato internacional, solo dígitos. */
    async sendText(to, body) {
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/${apiVersion}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body, preview_url: false },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        const error = new WhatsAppError(`No se pudo conectar con WhatsApp: ${cause.message}`);
        error.cause = cause;
        throw error;
      }
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new WhatsAppError(json?.error?.message || `WhatsApp respondió HTTP ${response.status}`, {
          status: response.status,
          code: json?.error?.code,
        });
      }
      return json;
    },
  };
}

/**
 * Verifica el header X-Hub-Signature-256 que Meta manda en cada webhook:
 * "sha256=" + HMAC-SHA256(cuerpo crudo, secreto de la app) en hexadecimal.
 */
export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(signatureHeader.slice('sha256='.length), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Saca los mensajes entrantes del cuerpo de un webhook de WhatsApp.
 * Ignora los avisos de estado (enviado, entregado, leído).
 * Devuelve [{ id, from, type, text }]; `text` es null si no es un mensaje de texto.
 */
export function extractMessages(payload) {
  const messages = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const message of change?.value?.messages ?? []) {
        if (!message?.id || !message?.from) continue;
        messages.push({
          id: message.id,
          from: message.from,
          type: message.type,
          text: message.type === 'text' ? (message.text?.body ?? '') : null,
        });
      }
    }
  }
  return messages;
}
