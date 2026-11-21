import { Injectable, Logger } from '@nestjs/common';
import type { PaidChargeNotice } from '../../charges/interfaces/charge-expiry.interface';
import { ChargeLifecycleService } from '../../charges/services/charge-lifecycle.service';
import { UsersService } from '../../users/services/users.service';
import { paymentNotification } from '../policies/payment-notification.policy';
import { ExpoPushClient } from './expo-push-client.service';
import { PushTokensService } from './push-tokens.service';

/**
 * Avisa "Pago recibido" al vendedor del cobro y a los admins activos.
 * Si Expo falla, lanza el error y el cobro queda sin `notified_at`: el
 * barrido lo vuelve a intentar. Nunca avisa dos veces el mismo cobro.
 */
@Injectable()
export class PaymentNotifier {
  private readonly logger = new Logger(PaymentNotifier.name);

  constructor(
    private readonly lifecycle: ChargeLifecycleService,
    private readonly users: UsersService,
    private readonly tokens: PushTokensService,
    private readonly expo: ExpoPushClient,
  ) {}

  async notifyPaid(chargeId: number): Promise<void> {
    const notice = await this.lifecycle.findPendingNotice(chargeId);
    if (notice) await this.send(notice);
  }

  /** Reintenta los avisos que no se pudieron entregar. Un fallo no detiene a los demás. */
  async retryPending(): Promise<void> {
    for (const notice of await this.lifecycle.listPendingNotices()) {
      try {
        await this.send(notice);
      } catch (error) {
        this.logger.warn(
          `cobro ${notice.chargeId}: no se pudo avisar del pago: ${(error as Error).message}`,
        );
      }
    }
  }

  private async send(notice: PaidChargeNotice): Promise<void> {
    const recipients = await this.recipients(notice);
    const devices = await this.tokens.tokensFor(recipients);
    const message = paymentNotification(notice);

    const tickets = await this.expo.send(
      devices.map((to) => ({ to, ...message })),
    );

    // Expo avisa qué dispositivos ya no existen (app desinstalada): se dejan de usar.
    const gone = devices.filter(
      (_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered',
    );
    await this.tokens.removeTokens(gone);
    await this.lifecycle.markNotified(notice.chargeId);
  }

  /** Quien hizo el cobro y los admins activos de SU negocio (nunca los de otro). */
  private async recipients(notice: PaidChargeNotice): Promise<number[]> {
    const admins = (
      await this.users.list({ businessId: notice.businessId, role: 'admin' })
    )
      .filter((u) => u.active)
      .map((u) => u.id);
    const sellerId = notice.sellerId;
    const seller = await this.users.findById(sellerId);
    return [...new Set([...(seller?.active ? [seller.id] : []), ...admins])];
  }
}
