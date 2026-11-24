/** Periodos del resumen del panel (los mismos que acepta la API). */
export const OVERVIEW_DAYS = [7, 30, 90] as const;
export type OverviewDays = (typeof OVERVIEW_DAYS)[number];

export const METHOD_LABELS = {
  push: 'Push al celular',
  qr: 'QR',
  link: 'Liga de pago',
} as const;
