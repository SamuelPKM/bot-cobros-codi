import { toCsv } from './csv.policy';

describe('toCsv', () => {
  it('arma encabezado y filas con CRLF, con BOM para que Excel lea los acentos', () => {
    const csv = toCsv(['id', 'concepto'], [[1, 'Café']]);
    expect(csv).toBe('\uFEFFid,concepto\r\n1,Café\r\n');
  });

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(toCsv(['a'], [['uno, dos']])).toContain('"uno, dos"');
    expect(toCsv(['a'], [['dijo "hola"']])).toContain('"dijo ""hola"""');
    expect(toCsv(['a'], [['línea\nnueva']])).toContain('"línea\nnueva"');
  });

  it.each(['=HYPERLINK("http://x")', '+1+1', '-2', '@SUMA(A1)', '\tx'])(
    'neutraliza fórmulas de hoja de cálculo: %j',
    (value) => {
      const cell = toCsv(['a'], [[value]]).split('\r\n')[1];
      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('los números negativos de verdad no se tocan; null y undefined quedan vacíos', () => {
    expect(
      toCsv(['a', 'b', 'c'], [[-5, null, undefined]]).split('\r\n')[1],
    ).toBe('-5,,');
  });
});
