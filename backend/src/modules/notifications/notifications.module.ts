import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../../config/env.validation';
import { ChargesModule } from '../charges/charges.module';
import { UsersModule } from '../users/users.module';
import { EXPO_FETCH } from './constants/notifications.constants';
import { PushTokensController } from './controllers/push-tokens.controller';
import { PushToken } from './entities/push-token.entity';
import { ExpoPushClient } from './services/expo-push-client.service';
import { PaymentNotifier } from './services/payment-notifier.service';
import { PushTokensService } from './services/push-tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushToken]), ChargesModule, UsersModule],
  controllers: [PushTokensController],
  providers: [
    PushTokensService,
    PaymentNotifier,
    { provide: EXPO_FETCH, useValue: globalThis.fetch },
    {
      provide: ExpoPushClient,
      inject: [ConfigService, EXPO_FETCH],
      useFactory: (
        config: ConfigService<Env, true>,
        fetch: typeof globalThis.fetch,
      ) =>
        new ExpoPushClient({
          fetch,
          accessToken: config.get('EXPO_ACCESS_TOKEN', { infer: true }),
        }),
    },
  ],
  exports: [PaymentNotifier],
})
export class NotificationsModule {}
