import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PaidChargeNotice } from '../../charges/interfaces/charge-expiry.interface';
import { texts } from '../../conversations/policies/conversation-texts';
import { WhatsAppAccountsService } from './whatsapp-accounts.service';
import { WhatsAppClient } from './whatsapp-client.service';

/**
 * Manda "✅ Pagado" por WhatsApp a quien hizo el cobro, si tiene el número ligado.
 * Es un extra del aviso push: si falla se registra y no se reintenta.
 */
@Injectable()
export class WhatsAppPaymentNotifier {
  private readonly logger = new Logger(WhatsAppPaymentNotifier.name);

  constructor(
    @Inject(WhatsAppClient) private readonly client: WhatsAppClient | null,
    private readonly accounts: WhatsAppAccountsService,
  ) {}

  async notifyPaid(notice: PaidChargeNotice): Promise<void> {
    if (!this.client) return;
    try {
      const to = await this.accounts.waIdOf(notice.sellerId);
      if (!to) return;
      await this.client.sendText(to, texts.paid(notice, notice.trackingKey));
    } catch (error) {
      this.logger.warn(
        `cobro ${notice.chargeId}: no se pudo avisar por WhatsApp: ${(error as Error).message}`,
      );
    }
  }
}
