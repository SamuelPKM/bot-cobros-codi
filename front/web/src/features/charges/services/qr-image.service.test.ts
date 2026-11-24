import { describe, expect, it } from 'vitest';
import { qrDataUrl } from './qr-image.service';

describe('qrDataUrl', () => {
  it('dibuja el qrString tal cual como PNG en data URL', async () => {
    const url = await qrDataUrl('{"TYP":20,"v":{"DEV":"x"}}');
    expect(url).toMatch(/^data:image\/png;base64,/);
    const png = Buffer.from(url.split(',')[1], 'base64');
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
