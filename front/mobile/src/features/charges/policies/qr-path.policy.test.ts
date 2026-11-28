import QRCode from 'qrcode';
import { qrPath } from './qr-path.policy';

describe('qrPath', () => {
  const qrString = '{"TYP":19,"v":{"DEV":"0000"},"ic":{"IDC":"abc"}}';

  it('dibuja cada módulo oscuro del QR (corrección M, borde 4)', () => {
    const { size, path } = qrPath(qrString);
    const { modules } = QRCode.create(qrString, { errorCorrectionLevel: 'M' });

    expect(size).toBe(modules.size + 8);
    let dark = 0;
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++)
        if (modules.get(x, y)) {
          dark++;
          expect(path).toContain(`M${x + 4} ${y + 4}h1v1h-1z`);
        }
    expect(path.match(/M/g)).toHaveLength(dark);
  });

  it('codifica el texto tal cual lo entrega pey', () => {
    expect(qrPath(qrString)).toEqual(qrPath(qrString));
    expect(qrPath(qrString).path).not.toEqual(qrPath(`${qrString} `).path);
  });
});
