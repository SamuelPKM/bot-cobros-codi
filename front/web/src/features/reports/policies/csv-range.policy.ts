const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export type CsvRange =
  | { ok: true; query: string; filename: string }
  | { ok: false; error: string };

/**
 * Rango del CSV de cobros: las dos fechas (AAAA-MM-DD) o ninguna (hoy). El
 * tope de 93 días lo revisa la API.
 */
export function parseCsvRange(params: URLSearchParams): CsvRange {
  const from = params.get('from')?.trim() || '';
  const to = params.get('to')?.trim() || '';
  if (!from && !to) return { ok: true, query: '', filename: 'cobros-hoy.csv' };
  if (!from || !to) return { ok: false, error: 'Elige las dos fechas o ninguna' };
  if (!DATE.test(from) || !DATE.test(to))
    return { ok: false, error: 'La fecha debe tener la forma AAAA-MM-DD' };
  if (from > to) return { ok: false, error: 'La fecha inicial debe ser anterior a la final' };
  return {
    ok: true,
    query: `?${new URLSearchParams({ from, to }).toString()}`,
    filename: `cobros-${from}-a-${to}.csv`,
  };
}
