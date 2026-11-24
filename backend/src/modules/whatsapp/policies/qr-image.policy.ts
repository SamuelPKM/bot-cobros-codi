import QRCode from 'qrcode';

/**
 * PNG del QR CoDi para mandarlo por WhatsApp. El qrString se codifica tal cual
 * (pey pide no parsearlo ni reformatearlo), con corrección de errores M y borde 4.
 */
export function renderQrPng(qrString: string): Promise<Buffer> {
  return QRCode.toBuffer(qrString, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 4,
    scale: 10,
  });
}
