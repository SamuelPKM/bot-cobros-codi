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
 *
 * Cada negocio tiene su propia API key y, por lo tanto, su propio secreto: se
 * verifica con el del negocio al que va dirigido el webhook.
 */
export class PeyWebhookVerifier {
  verify(
    secret: string | null,
    rawBody: Buffer | undefined,
    headers: Headers,
  ): VerifiedWebhook {
    if (!secret) {
      throw new ServiceUnavailableException(
        'Este negocio aún no registra el secreto de su webhook de pey',
      );
    }
    const id = headers['webhook-id'];
    if (!rawBody || typeof id !== 'string')
      throw new UnauthorizedException('Firma inválida');

    try {
      const event = new Webhook(secret).verify(rawBody.toString('utf8'), {
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
