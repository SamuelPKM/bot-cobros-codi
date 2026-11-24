import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsAppLinkController } from './controllers/whatsapp-link.controller';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsAppInboundService } from './services/whatsapp-inbound.service';
import { WhatsAppMessagingModule } from './whatsapp-messaging.module';

/** Canal de WhatsApp: ligar el número y cobrar por chat (webhook de Meta). */
@Module({
  imports: [WhatsAppMessagingModule, ConversationsModule, BusinessesModule],
  controllers: [WhatsAppWebhookController, WhatsAppLinkController],
  providers: [WhatsAppInboundService],
})
export class WhatsAppModule {}
