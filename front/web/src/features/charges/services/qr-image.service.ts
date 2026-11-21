import QRCode from 'qrcode';

/**
 * PNG del QR CoDi como data URL. El qrString se codifica tal cual (pey pide no
 * reformatearlo), con corrección de errores M y borde 4.
 */
export function qrDataUrl(qrString: string): Promise<string> {
  return QRCode.toDataURL(qrString, {
    errorCorrectionLevel: 'M',
    margin: 4,
    scale: 8,
  });
}
