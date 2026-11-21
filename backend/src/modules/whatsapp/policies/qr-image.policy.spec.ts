import { renderQrPng } from './qr-image.policy';

describe('renderQrPng', () => {
  it('dibuja el qrString tal cual en un PNG', async () => {
    const png = await renderQrPng('{"TYP":1,"v":"01","IDC":"IDC1"}');
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.length).toBeGreaterThan(500);
  });
});
