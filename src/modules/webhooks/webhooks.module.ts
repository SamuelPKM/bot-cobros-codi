import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../../config/env.validation';
import { ChargesModule } from '../charges/charges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeyModule } from '../pey/pey.module';
import { PeyWebhookController } from './controllers/pey-webhook.controller';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PeyWebhookService } from './services/pey-webhook.service';
import { PeyWebhookVerifier } from './services/pey-webhook-verifier.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent]),
    PeyModule,
    ChargesModule,
    NotificationsModule,
  ],
  controllers: [PeyWebhookController],
  providers: [
    PeyWebhookService,
    {
      provide: PeyWebhookVerifier,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new PeyWebhookVerifier(
          config.get('PEY_WEBHOOK_SECRET', { infer: true }),
        ),
    },
  ],
})
export class WebhooksModule {}
