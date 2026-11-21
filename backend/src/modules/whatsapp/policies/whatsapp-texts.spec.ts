import { whatsappTexts } from './whatsapp-texts';

describe('whatsappTexts', () => {
  it('a un número sin cuenta le dice dónde registrarse y cómo ligarlo', () => {
    const text = whatsappTexts.notRegistered('https://cobrale.test');
    expect(text).toMatch(/no está ligado/);
    expect(text).toContain('https://cobrale.test');
    expect(text).toMatch(/vincular 123456/);
  });

  it('confirma a qué negocio y persona quedó ligado', () => {
    expect(whatsappTexts.linked('Tacos Ana', 'Ana')).toMatch(
      /quedó ligado a \*Tacos Ana\* como Ana/,
    );
  });

  it('explica el código inválido y el exceso de intentos', () => {
    expect(whatsappTexts.invalidCode()).toMatch(/no es válido o ya venció/);
    expect(whatsappTexts.tooManyAttempts()).toMatch(/Demasiados intentos/);
  });
});
