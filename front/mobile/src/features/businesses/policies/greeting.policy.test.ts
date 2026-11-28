import { firstName, formatLongDate, greetingFor, headerGreeting } from './greeting.policy';

// Ciudad de México es UTC-6 todo el año.
const at = (hourMx: number) => new Date(Date.UTC(2026, 11, 1, hourMx + 6, 30));

describe('greetingFor', () => {
  it('buenos días de 5 a 11', () => {
    expect(greetingFor(at(5))).toBe('Buenos días');
    expect(greetingFor(at(11))).toBe('Buenos días');
  });
  it('buenas tardes de 12 a 18', () => {
    expect(greetingFor(at(12))).toBe('Buenas tardes');
    expect(greetingFor(at(18))).toBe('Buenas tardes');
  });
  it('buenas noches el resto', () => {
    expect(greetingFor(at(19))).toBe('Buenas noches');
    expect(greetingFor(at(0))).toBe('Buenas noches');
    expect(greetingFor(at(4))).toBe('Buenas noches');
  });
  it('usa la hora de la Ciudad de México, no la del aparato', () => {
    // 03:00 UTC del día 2 = 21:00 del día 1 en CDMX.
    expect(greetingFor(new Date('2026-12-02T03:00:00Z'))).toBe('Buenas noches');
  });
});

describe('formatLongDate', () => {
  it('día de la semana, día y mes con mayúscula inicial', () => {
    expect(formatLongDate(at(10))).toBe('Martes, 1 de diciembre');
  });
  it('respeta el día de la Ciudad de México', () => {
    expect(formatLongDate(new Date('2026-12-02T03:00:00Z'))).toBe('Martes, 1 de diciembre');
  });
});

describe('headerGreeting', () => {
  it('saludo, primer nombre y fecha', () => {
    expect(headerGreeting('Ana Prueba', at(10))).toBe('Buenos días, Ana · Martes, 1 de diciembre');
  });
});

describe('firstName', () => {
  it('primera palabra', () => {
    expect(firstName('  Ana María ')).toBe('Ana');
  });
});
