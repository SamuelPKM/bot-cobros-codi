import { formatDateTime, formatMoney, formatPhone, formatTime } from './format';

describe('format', () => {
  it('pesos con dos decimales y separador de miles', () => {
    expect(formatMoney(1500)).toBe('$1,500.00');
    expect(formatMoney(0.5)).toBe('$0.50');
  });

  it('celular de 10 dígitos en bloques', () => {
    expect(formatPhone('5512345678')).toBe('55 1234 5678');
    expect(formatPhone(null)).toBe('—');
  });

  it('fecha y hora de la Ciudad de México', () => {
    expect(formatDateTime('2026-12-01T18:05:00Z')).toBe('01/12/2026, 12:05');
  });

  it('solo la hora, para la lista de hoy', () => {
    expect(formatTime('2026-12-01T18:05:00Z')).toBe('12:05');
  });
});
