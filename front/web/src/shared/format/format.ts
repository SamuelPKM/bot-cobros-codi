const pesos = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  currencyDisplay: 'narrowSymbol',
});

const dateTime = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 1500 → "$1,500.00". La API habla en pesos. */
export const formatMoney = (amount: number): string => pesos.format(amount);

/** "5512345678" → "55 1234 5678". */
export const formatPhone = (phone: string | null): string =>
  phone ? `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}` : '—';

/** ISO 8601 → "01/12/2026, 12:05", hora de la Ciudad de México. */
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
