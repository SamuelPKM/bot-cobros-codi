// Qué imagen se acepta como logo. Se mira el contenido (los primeros bytes),
// no el nombre del archivo ni el Content-Type que manda el navegador. SVG no:
// puede llevar scripts.

/** 1 MB: de sobra para un logo. */
export const MAX_LOGO_BYTES = 1024 * 1024;

export interface LogoFormat {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
}

const startsWith = (data: Buffer, bytes: number[], offset = 0) =>
  data.length >= offset + bytes.length &&
  bytes.every((byte, i) => data[offset + i] === byte);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** PNG, JPEG o WebP según sus bytes; null si es otra cosa. */
export function detectLogoFormat(data: Buffer): LogoFormat | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { contentType: 'image/png', extension: 'png' };
  if (startsWith(data, [0xff, 0xd8, 0xff]))
    return { contentType: 'image/jpeg', extension: 'jpg' };
  if (startsWith(data, ascii('RIFF')) && startsWith(data, ascii('WEBP'), 8))
    return { contentType: 'image/webp', extension: 'webp' };
  return null;
}

/**
 * La versión de un logo, para que la web lo pida con otra URL cuando cambia:
 * el nombre del archivo sin la extensión ("logos/7/3fa9c2.png" → "3fa9c2").
 */
export function logoVersion(key: string | null): string | null {
  if (!key) return null;
  const file = key.split('/').pop() ?? '';
  return file.replace(/\.[a-z]+$/, '') || null;
}
