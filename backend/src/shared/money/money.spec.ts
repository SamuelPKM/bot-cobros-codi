import { centsToPesos, pesosToCents } from './money';

describe('money', () => {
  it('convierte pesos a centavos sin errores de punto flotante', () => {
    expect(pesosToCents(0.01)).toBe(1);
    expect(pesosToCents(19.99)).toBe(1999);
    expect(pesosToCents(0.29)).toBe(29);
  });

  it('convierte centavos a pesos', () => {
    expect(centsToPesos(50_000)).toBe(500);
    expect(centsToPesos(1)).toBe(0.01);
  });
});
