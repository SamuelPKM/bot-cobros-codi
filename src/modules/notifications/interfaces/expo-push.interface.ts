/** Mensaje para la API de Expo Push (https://docs.expo.dev/push-notifications/sending-notifications/). */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

/** Respuesta por mensaje, en el mismo orden en que se mandaron. */
export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushClientOptions {
  fetch: typeof globalThis.fetch;
  accessToken?: string;
}
