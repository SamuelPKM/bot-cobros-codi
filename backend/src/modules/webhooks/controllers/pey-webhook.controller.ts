import {
  Controller,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { BusinessesService } from '../../businesses/services/businesses.service';
import type { WebhookResult } from '../interfaces/pey-webhook-event.interface';
import { PeyWebhookService } from '../services/pey-webhook.service';
import { PeyWebhookVerifier } from '../services/pey-webhook-verifier.service';

/**
 * Público: no lleva Bearer token; lo autentica la firma de pey.
 * Cada negocio registra en pey su propia URL: /webhooks/pey/:slug.
 */
@Public()
@Controller('webhooks')
export class PeyWebhookController {
  private readonly logger = new Logger(PeyWebhookController.name);

  constructor(
    private readonly verifier: PeyWebhookVerifier,
    private readonly businesses: BusinessesService,
    private readonly webhooks: PeyWebhookService,
  ) {}

  @Post('pey/:slug')
  @HttpCode(200)
  async receive(
    @Param('slug') slug: string,
    @Req() req: RawBodyRequest<Request>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; result: WebhookResult } | { ok: false }> {
    const target = await this.businesses.webhookTarget(slug);
    if (!target) throw new NotFoundException();

    // 401 (firma) y 503 (el negocio aún no registra su secreto) salen como excepciones HTTP.
    const verified = this.verifier.verify(
      target.secret,
      req.rawBody,
      req.headers,
    );
    try {
      return {
        ok: true,
        result: await this.webhooks.handle(target.businessId, verified),
      };
    } catch (error) {
      // 500: pey reintentará la entrega; marcar pagado es idempotente.
      this.logger.error(
        `negocio ${target.businessId} ${verified.id} ${verified.event.type ?? ''} falló: ${(error as Error).message}`,
      );
      res.status(500);
      return { ok: false };
    }
  }
}
