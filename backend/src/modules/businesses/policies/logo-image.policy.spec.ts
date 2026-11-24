import { detectLogoFormat, logoVersion } from './logo-image.policy';

const bytes = (...values: number[]) => Buffer.from(values);

describe('detectLogoFormat', () => {
  it('reconoce PNG, JPEG y WebP por su contenido', () => {
    expect(
      detectLogoFormat(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0),
      ),
    ).toEqual({ contentType: 'image/png', extension: 'png' });
    expect(detectLogoFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(
      detectLogoFormat(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ')),
    ).toEqual({ contentType: 'image/webp', extension: 'webp' });
  });

  it('rechaza SVG, GIF, texto y archivos cortados', () => {
    expect(detectLogoFormat(Buffer.from('<svg onload="alert(1)">'))).toBeNull();
    expect(detectLogoFormat(Buffer.from('GIF89a'))).toBeNull();
    expect(detectLogoFormat(Buffer.from('hola'))).toBeNull();
    expect(detectLogoFormat(bytes(0x89, 0x50))).toBeNull();
    expect(
      detectLogoFormat(Buffer.from('RIFF\x00\x00\x00\x00WAVE')),
    ).toBeNull();
  });
});

describe('logoVersion', () => {
  it('es el nombre del archivo sin extensión', () => {
    expect(logoVersion('logos/7/3fa9c2b1.png')).toBe('3fa9c2b1');
    expect(logoVersion(null)).toBeNull();
  });
});
