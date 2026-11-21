import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ChargesModule } from '../charges/charges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeyWebhookController } from './controllers/pey-webhook.controller';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PeyWebhookService } from './services/pey-webhook.service';
import { PeyWebhookVerifier } from './services/pey-webhook-verifier.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent]),
    BusinessesModule,
    ChargesModule,
    NotificationsModule,
  ],
  controllers: [PeyWebhookController],
  providers: [PeyWebhookService, PeyWebhookVerifier],
})
export class WebhooksModule {}
