import { describe, expect, it } from 'vitest';
import { parseCsvRange } from './csv-range.policy';

const params = (query: string) => new URLSearchParams(query);

describe('parseCsvRange', () => {
  it('sin fechas: hoy (la API decide el día de la Ciudad de México)', () => {
    expect(parseCsvRange(params(''))).toEqual({ ok: true, query: '', filename: 'cobros-hoy.csv' });
  });

  it('con rango: lo pasa a la API y nombra el archivo', () => {
    expect(parseCsvRange(params('from=2026-11-01&to=2026-11-30'))).toEqual({
      ok: true,
      query: '?from=2026-11-01&to=2026-11-30',
      filename: 'cobros-2026-11-01-a-2026-11-30.csv',
    });
  });

  it('rechaza fechas mal escritas o al revés', () => {
    expect(parseCsvRange(params('from=2026-13-01&to=2026-11-30'))).toEqual({
      ok: false,
      error: 'La fecha debe tener la forma AAAA-MM-DD',
    });
    expect(parseCsvRange(params('from=2026-11-30&to=2026-11-01'))).toEqual({
      ok: false,
      error: 'La fecha inicial debe ser anterior a la final',
    });
    expect(parseCsvRange(params('from=2026-11-01'))).toEqual({
      ok: false,
      error: 'Elige las dos fechas o ninguna',
    });
  });
});
