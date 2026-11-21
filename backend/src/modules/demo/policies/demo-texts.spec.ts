import { demoTexts } from './demo-texts';

describe('demoTexts', () => {
  it('la bienvenida nombra al negocio, los comandos y el tope', () => {
    const text = demoTexts.welcome('Tacos Demo', 150);
    expect(text).toContain('*Tacos Demo*');
    expect(text).toMatch(/cobra 0\.01[\s\S]*qr 0\.01[\s\S]*liga 0\.01/);
    expect(text).toContain('$1.50');
  });

  it('explica el límite de cobros por hora', () => {
    expect(demoTexts.tooManyCharges(5)).toMatch(/límite de 5 cobros por hora/);
  });
});
