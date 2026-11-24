// CSV para Excel y hojas de cálculo: RFC 4180 (comas, comillas y saltos de
// línea entre comillas, CRLF) con BOM para que Excel lea UTF-8, y protección
// contra inyección de fórmulas: un texto que empieza con = + - @ o un
// tabulador se antepone con ' para que la hoja no lo ejecute.

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;
const BOM = '\uFEFF';

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
