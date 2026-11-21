import type {
  ExpoPushMessage,
  ExpoPushTicket,
} from '../../src/modules/notifications/interfaces/expo-push.interface';

/** Expo Push simulado: guarda lo enviado; `failNext` hace fallar el siguiente envío. */
export class FakeExpoPushClient {
  readonly sent: ExpoPushMessage[] = [];
  /** Tokens que Expo reporta como DeviceNotRegistered (app desinstalada). */
  readonly unregistered = new Set<string>();
  private failing = false;

  failNext(): void {
    this.failing = true;
  }

  reset(): void {
    this.sent.length = 0;
    this.unregistered.clear();
    this.failing = false;
  }

  send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (this.failing) {
      this.failing = false;
      return Promise.reject(new Error('Expo respondió HTTP 503'));
    }
    this.sent.push(...messages);
    return Promise.resolve(
      messages.map((m) =>
        this.unregistered.has(m.to)
          ? {
              status: 'error',
              message: 'not registered',
              details: { error: 'DeviceNotRegistered' },
            }
          : { status: 'ok', id: `ticket-${m.to}` },
      ),
    );
  }
}
