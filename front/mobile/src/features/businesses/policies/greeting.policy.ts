const CDMX = 'America/Mexico_City';

const hourFormat = new Intl.DateTimeFormat('es-MX', { timeZone: CDMX, hour: 'numeric', hourCycle: 'h23' });
const dateFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: CDMX,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Saludo según la hora de la Ciudad de México. */
export function greetingFor(now: Date): 'Buenos días' | 'Buenas tardes' | 'Buenas noches' {
  const hour = Number(hourFormat.formatToParts(now).find((part) => part.type === 'hour')?.value) % 24;
  if (hour >= 5 && hour <= 11) return 'Buenos días';
  if (hour >= 12 && hour <= 18) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "Martes, 1 de diciembre". */
export function formatLongDate(now: Date): string {
  const text = dateFormat.format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

/** "Buenos días, Ana · Martes, 1 de diciembre". */
export const headerGreeting = (userName: string, now: Date): string =>
  `${greetingFor(now)}, ${firstName(userName)} · ${formatLongDate(now)}`;
