import { demoTexts } from './demo-texts';

describe('demoTexts', () => {
  it('la bienvenida nombra al negocio, los comandos y el tope', () => {
    const text = demoTexts.welcome('Tacos Demo', 150);
    expect(text).toContain('*Tacos Demo*');
    expect(text).toMatch(/qr 0\.01[\s\S]*liga 0\.01/);
    expect(text).not.toMatch(/cobra 0\.01/);
    expect(text).toContain('$1.50');
  });

  it('explica por qué no hay cobro al celular en la demo', () => {
    expect(demoTexts.pushDisabled()).toMatch(/no se mandan cobros al celular/);
  });

  it('explica el límite de cobros por hora', () => {
    expect(demoTexts.tooManyCharges(5)).toMatch(/límite de 5 cobros por hora/);
  });
});
