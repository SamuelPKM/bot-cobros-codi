/** Los días de corte se cuentan en la hora de la Ciudad de México. */
export const REPORT_TIME_ZONE = 'America/Mexico_City';

/** Rango máximo de un CSV de cobros (un trimestre). */
export const MAX_EXPORT_DAYS = 93;

export const CSV_HEADERS = [
  'id',
  'fecha',
  'vendedor',
  'celular',
  'monto',
  'concepto',
  'estado',
  'pagado_por',
  'pagado_el',
];
