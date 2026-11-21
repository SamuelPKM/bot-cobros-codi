import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Env } from '../../../config/env.validation';
import { BusinessesService } from '../../businesses/services/businesses.service';
import type { ConversationReply } from '../../conversations/interfaces/conversation.interfaces';
import { parseMessage } from '../../conversations/policies/command.parser';
import { ConversationService } from '../../conversations/services/conversation.service';
import {
  LINK_ATTEMPTS_WINDOW_MS,
  LINK_MAX_FAILED_ATTEMPTS,
  WHATSAPP_SOURCE,
} from '../constants/whatsapp.constants';
import type { IncomingMessage } from '../policies/meta-webhook.policy';
import { renderQrPng } from '../policies/qr-image.policy';
import { phoneFromWaId } from '../policies/wa-phone.policy';
import { whatsappTexts } from '../policies/whatsapp-texts';
import { WhatsAppAccountsService } from './whatsapp-accounts.service';
import { WhatsAppClient } from './whatsapp-client.service';

/**
 * Atiende los mensajes que llegan por WhatsApp:
 *  - Cada mensaje (por su id de Meta) se atiende una sola vez.
 *  - "vincular 123456" liga el número a la cuenta dueña del código.
 *  - Un número ligado a una persona activa conversa con el motor de cobros.
 *  - Cualquier otro recibe cómo registrarse en la web.
 * Nunca lanza: un fallo se registra y Meta recibe 200 igual (si no, reenvía).
 */
@Injectable()
export class WhatsAppInboundService {
  private readonly logger = new Logger(WhatsAppInboundService.name);
  private readonly frontendUrl: string;
  /** Códigos equivocados por número (en memoria: la API corre en una instancia). */
  private readonly failedLinks = new Map<string, number[]>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(WhatsAppClient) private readonly client: WhatsAppClient,
    private readonly accounts: WhatsAppAccountsService,
    private readonly businesses: BusinessesService,
    private readonly conversation: ConversationService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  async handle(messages: IncomingMessage[]): Promise<void> {
    for (const message of messages) {
      if (!(await this.claim(message.id))) continue;
      let result = 'ok';
      try {
        await this.send(message.from, await this.reply(message));
      } catch (error) {
        result = 'error';
        this.logger.error(`mensaje ${message.id}: ${(error as Error).message}`);
      }
      await this.dataSource.query(
        `UPDATE webhook_events SET processed_at = now(), result = $3
          WHERE source = $1 AND id = $2`,
        [WHATSAPP_SOURCE, message.id, result],
      );
    }
  }

  /** true solo la primera vez que llega este mensaje. */
  private async claim(id: string): Promise<boolean> {
    const rows = await this.dataSource.query<unknown[]>(
      `INSERT INTO webhook_events (source, id, type) VALUES ($1, $2, 'message')
       ON CONFLICT DO NOTHING RETURNING id`,
      [WHATSAPP_SOURCE, id],
    );
    return rows.length > 0;
  }

  private async reply(message: IncomingMessage): Promise<ConversationReply[]> {
    const command = message.text === null ? null : parseMessage(message.text);
    if (command?.type === 'link-account')
      return [{ text: await this.link(command.code, message.from) }];

    const phone = phoneFromWaId(message.from);
    const user = phone ? await this.accounts.findActiveUser(phone) : null;
    if (!user) return [{ text: whatsappTexts.notRegistered(this.frontendUrl) }];
    return this.conversation.handle(user, message.text);
  }

  private async link(code: string, waId: string): Promise<string> {
    const now = Date.now();
    const recent = (this.failedLinks.get(waId) ?? []).filter(
      (at) => now - at < LINK_ATTEMPTS_WINDOW_MS,
    );
    if (recent.length >= LINK_MAX_FAILED_ATTEMPTS)
      return whatsappTexts.tooManyAttempts();

    const user = await this.accounts.link(code, waId);
    if (!user) {
      this.forgetOldFailures(now);
      this.failedLinks.set(waId, [...recent, now]);
      return whatsappTexts.invalidCode();
    }
    this.failedLinks.delete(waId);
    const business = await this.businesses.getById(user.businessId);
    return whatsappTexts.linked(business.name, user.name);
  }

  /** Que el contador no crezca sin fin con números que fallaron hace rato. */
  private forgetOldFailures(now: number): void {
    if (this.failedLinks.size < 1000) return;
    for (const [waId, attempts] of this.failedLinks)
      if (attempts.every((at) => now - at >= LINK_ATTEMPTS_WINDOW_MS))
        this.failedLinks.delete(waId);
  }

  private async send(to: string, replies: ConversationReply[]): Promise<void> {
    for (const reply of replies) {
      if (reply.qrString)
        await this.client.sendImage(
          to,
          await renderQrPng(reply.qrString),
          reply.text,
        );
      else await this.client.sendText(to, reply.text);
    }
  }
}
