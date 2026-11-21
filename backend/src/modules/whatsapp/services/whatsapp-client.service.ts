import { WhatsAppError } from '../errors/whatsapp.error';

const GRAPH_URL = 'https://graph.facebook.com';
const TIMEOUT_MS = 15_000;

export interface WhatsAppClientOptions {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  fetch: typeof globalThis.fetch;
}

/** Adaptador de WhatsApp Cloud API (Meta): mandar texto e imágenes. */
export class WhatsAppClient {
  constructor(private readonly options: WhatsAppClientOptions) {}

  /** `to`: el número como lo entrega Meta, solo dígitos con lada de país. */
  async sendText(to: string, body: string): Promise<void> {
    await this.call('messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    });
  }

  /** WhatsApp pide subir la imagen primero (POST /media) y luego mandarla por su id. */
  async sendImage(to: string, png: Buffer, caption?: string): Promise<void> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    form.append(
      'file',
      new Blob([new Uint8Array(png)], { type: 'image/png' }),
      'qr.png',
    );
    const media = (await this.call('media', form)) as { id?: string };
    if (!media.id)
      throw new WhatsAppError('WhatsApp no devolvió el id de la imagen subida');

    await this.call('messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { id: media.id, ...(caption ? { caption } : {}) },
    });
  }

  private async call(path: string, body: object | FormData): Promise<unknown> {
    const { token, phoneNumberId, apiVersion, fetch } = this.options;
    let response: Response;
    try {
      response = await fetch(
        `${GRAPH_URL}/${apiVersion}/${phoneNumberId}/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Con FormData, fetch pone el Content-Type multipart con su boundary.
            ...(body instanceof FormData
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          body: body instanceof FormData ? body : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (cause) {
      throw new WhatsAppError(
        `No se pudo conectar con WhatsApp: ${(cause as Error).message}`,
        { cause },
      );
    }
    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number };
    };
    if (!response.ok) {
      throw new WhatsAppError(
        json.error?.message ?? `WhatsApp respondió HTTP ${response.status}`,
        {
          status: response.status,
          code: json.error?.code,
        },
      );
    }
    return json;
  }
}
