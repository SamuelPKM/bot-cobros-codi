export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo acepta hasta 100 mensajes por petición. */
export const EXPO_CHUNK_SIZE = 100;

export const EXPO_TIMEOUT_MS = 10_000;

/** Token de inyección del `fetch` que usa ExpoPushClient. */
export const EXPO_FETCH = Symbol('EXPO_FETCH');

/** ExponentPushToken[...] o ExpoPushToken[...]. */
export const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/;
