import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { UsersModule } from '../users/users.module';
import { WhatsAppAccountsService } from './services/whatsapp-accounts.service';
import { WhatsAppClient } from './services/whatsapp-client.service';
import { WhatsAppPaymentNotifier } from './services/whatsapp-payment-notifier.service';

/**
 * Lo que necesita quien solo MANDA por WhatsApp (el aviso de pago): el cliente
 * de Meta y las cuentas ligadas. Sin WHATSAPP_* configurado el cliente es null
 * y no se manda nada. Separado de WhatsAppModule para no crear ciclos con
 * notificaciones.
 */
@Module({
  imports: [UsersModule],
  providers: [
    WhatsAppAccountsService,
    WhatsAppPaymentNotifier,
    {
      provide: WhatsAppClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const whatsapp = config.get('WHATSAPP', { infer: true });
        return whatsapp
          ? new WhatsAppClient({ ...whatsapp, fetch: globalThis.fetch })
          : null;
      },
    },
  ],
  exports: [WhatsAppClient, WhatsAppAccountsService, WhatsAppPaymentNotifier],
})
export class WhatsAppMessagingModule {}
