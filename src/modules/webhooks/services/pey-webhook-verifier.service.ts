import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Webhook } from 'standardwebhooks';
import type {
  PeyWebhookEvent,
  VerifiedWebhook,
} from '../interfaces/pey-webhook-event.interface';

type Headers = Record<string, string | string[] | undefined>;

/**
 * Verifica la firma Standard Webhooks de pey sobre el cuerpo CRUDO (los bytes
 * exactos que llegaron), nunca sobre el JSON re-serializado. También rechaza
 * entregas con un timestamp de más de 5 minutos (anti-replay).
 */
export class PeyWebhookVerifier {
  private readonly webhook: Webhook | null;

  /** Sin secreto el servidor arranca igual (el secreto existe solo después de registrar la URL en pey). */
  constructor(secret: string | undefined) {
    this.webhook = secret ? new Webhook(secret) : null;
  }

  verify(rawBody: Buffer | undefined, headers: Headers): VerifiedWebhook {
    if (!this.webhook) {
      throw new ServiceUnavailableException(
        'Webhook de pey sin configurar (falta PEY_WEBHOOK_SECRET)',
      );
    }
    const id = headers['webhook-id'];
    if (!rawBody || typeof id !== 'string')
      throw new UnauthorizedException('Firma inválida');

    try {
      const event = this.webhook.verify(rawBody.toString('utf8'), {
        'webhook-id': id,
        'webhook-timestamp': String(headers['webhook-timestamp'] ?? ''),
        'webhook-signature': String(headers['webhook-signature'] ?? ''),
      }) as PeyWebhookEvent;
      return { id, event };
    } catch {
      throw new UnauthorizedException('Firma inválida');
    }
  }
}
