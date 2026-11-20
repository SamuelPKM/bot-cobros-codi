import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import type { WebhookResult } from '../interfaces/pey-webhook-event.interface';
import { PeyWebhookService } from '../services/pey-webhook.service';
import { PeyWebhookVerifier } from '../services/pey-webhook-verifier.service';

/** Público: no lleva Bearer token; lo autentica la firma de pey. */
@Public()
@Controller('webhooks')
export class PeyWebhookController {
  private readonly logger = new Logger(PeyWebhookController.name);

  constructor(
    private readonly verifier: PeyWebhookVerifier,
    private readonly webhooks: PeyWebhookService,
  ) {}

  @Post('pey')
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; result: WebhookResult } | { ok: false }> {
    // 401 (firma) y 503 (sin secreto) salen de aquí como excepciones HTTP.
    const verified = this.verifier.verify(req.rawBody, req.headers);
    try {
      return { ok: true, result: await this.webhooks.handle(verified) };
    } catch (error) {
      // 500: pey reintentará la entrega; marcar pagado es idempotente.
      this.logger.error(
        `${verified.id} ${verified.event.type ?? ''} falló: ${(error as Error).message}`,
      );
      res.status(500);
      return { ok: false };
    }
  }
}
