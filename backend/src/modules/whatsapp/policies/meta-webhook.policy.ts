import { createHmac, timingSafeEqual } from 'node:crypto';

/** Un mensaje entrante. `text` es null si no es de texto (foto, audio…). */
export interface IncomingMessage {
  id: string;
  /** El número de quien escribe, como lo entrega Meta (p. ej. 5215512345678). */
  from: string;
  text: string | null;
}

/**
 * Verifica el header X-Hub-Signature-256 de Meta: "sha256=" + HMAC-SHA256 del
 * cuerpo CRUDO con el secreto de la app, en hexadecimal. Comparación en tiempo constante.
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  appSecret: string,
): boolean {
  if (
    !rawBody ||
    typeof signature !== 'string' ||
    !signature.startsWith('sha256=')
  )
    return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(signature.slice('sha256='.length), 'hex');
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

interface MetaPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
}

/** Saca los mensajes entrantes de un webhook de Meta; ignora los avisos de estado (enviado, leído…). */
export function extractMessages(payload: unknown): IncomingMessage[] {
  const messages: IncomingMessage[] = [];
  for (const entry of (payload as MetaPayload | null)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from) continue;
        messages.push({
          id: message.id,
          from: message.from,
          text: message.type === 'text' ? (message.text?.body ?? '') : null,
        });
      }
    }
  }
  return messages;
}
