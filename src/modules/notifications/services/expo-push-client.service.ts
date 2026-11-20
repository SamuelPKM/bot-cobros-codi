import {
  EXPO_CHUNK_SIZE,
  EXPO_PUSH_URL,
  EXPO_TIMEOUT_MS,
} from '../constants/notifications.constants';
import type {
  ExpoPushClientOptions,
  ExpoPushMessage,
  ExpoPushTicket,
} from '../interfaces/expo-push.interface';

/** Adaptador de la API de Expo Push. Lanza si Expo falla, para reintentar el aviso después. */
export class ExpoPushClient {
  constructor(private readonly options: ExpoPushClientOptions) {}

  async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const tickets: ExpoPushTicket[] = [];
    for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
      tickets.push(
        ...(await this.sendChunk(messages.slice(i, i + EXPO_CHUNK_SIZE))),
      );
    }
    return tickets;
  }

  private async sendChunk(
    messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    const response = await this.options.fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.options.accessToken
          ? { Authorization: `Bearer ${this.options.accessToken}` }
          : {}),
      },
      body: JSON.stringify(
        messages.map((m) => ({ sound: 'default', priority: 'high', ...m })),
      ),
      signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Expo respondió HTTP ${response.status}`);
    const json = (await response.json()) as { data?: ExpoPushTicket[] };
    return json.data ?? [];
  }
}
