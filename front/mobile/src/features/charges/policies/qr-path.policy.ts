import QRCode from 'qrcode';

const MARGIN = 4;

/**
 * Trazo SVG del QR CoDi: un cuadro de 1×1 por módulo oscuro, con borde 4 y
 * corrección M. El qrString se codifica tal cual (pey pide no reformatearlo).
 */
export function qrPath(qrString: string): { size: number; path: string } {
  const { modules } = QRCode.create(qrString, { errorCorrectionLevel: 'M' });
  const parts: string[] = [];
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++)
      if (modules.get(x, y)) parts.push(`M${x + MARGIN} ${y + MARGIN}h1v1h-1z`);
  return { size: modules.size + MARGIN * 2, path: parts.join('') };
}
