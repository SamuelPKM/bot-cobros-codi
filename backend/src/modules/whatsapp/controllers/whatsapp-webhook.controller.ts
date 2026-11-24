import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env, WhatsAppConfig } from '../../../config/env.validation';
import { Public } from '../../auth/decorators/public.decorator';
import {
  extractMessages,
  verifyMetaSignature,
} from '../policies/meta-webhook.policy';
import { WhatsAppInboundService } from '../services/whatsapp-inbound.service';

/**
 * Webhook de WhatsApp Cloud API. Público: lo autentica la firma de Meta
 * (X-Hub-Signature-256). Sin WHATSAPP_* configurado responde 404.
 */
@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly config: WhatsAppConfig | null;

  constructor(
    private readonly inbound: WhatsAppInboundService,
    config: ConfigService<Env, true>,
  ) {
    this.config = config.get('WHATSAPP', { infer: true });
  }

  /** Meta verifica la URL una vez, al registrarla. */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const config = this.configured();
    if (mode !== 'subscribe' || token !== config.verifyToken)
      throw new ForbiddenException();
    return challenge;
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ ok: true }> {
    const config = this.configured();
    const signature = req.headers['x-hub-signature-256'];
    if (
      !verifyMetaSignature(
        req.rawBody,
        typeof signature === 'string' ? signature : undefined,
        config.appSecret,
      )
    )
      throw new UnauthorizedException('Firma de Meta inválida');
    await this.inbound.handle(extractMessages(req.body));
    return { ok: true };
  }

  private configured(): WhatsAppConfig {
    if (!this.config) throw new NotFoundException();
    return this.config;
  }
}
