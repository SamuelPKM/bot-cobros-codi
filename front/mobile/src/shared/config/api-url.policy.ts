const MISSING =
  'Configura EXPO_PUBLIC_API_URL con la URL de la API (por ejemplo https://api.3-91-20-115.sslip.io).';

/** Hosts donde se permite HTTP: la compu de desarrollo vista desde el celular o el emulador. */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * URL base de la API. El token viaja en cada llamada, así que fuera de la red
 * local tiene que ser HTTPS.
 */
export function resolveApiUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) throw new Error(MISSING);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(MISSING);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOST.test(url.hostname)))
    throw new Error('EXPO_PUBLIC_API_URL debe usar HTTPS (HTTP solo en la red local).');
  return value.replace(/\/+$/, '');
}
