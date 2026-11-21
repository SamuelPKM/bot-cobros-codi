import { describe, expect, it } from 'vitest';
import { parseRegisterForm } from './register-form.policy';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const valid = {
  businessName: ' Tacos Ana ',
  adminName: ' Ana López ',
  username: 'ana.lopez',
  password: 'segura-123',
  peyApiKey: ' pey_live_abcdef123 ',
};

describe('parseRegisterForm', () => {
  it('acepta un registro completo y limpia espacios', () => {
    expect(parseRegisterForm(form(valid))).toEqual({
      ok: true,
      data: {
        businessName: 'Tacos Ana',
        adminName: 'Ana López',
        username: 'ana.lopez',
        password: 'segura-123',
        peyApiKey: 'pey_live_abcdef123',
      },
    });
  });

  it('explica cada campo inválido con las reglas de la API', () => {
    const result = parseRegisterForm(
      form({ businessName: 'x'.repeat(31), adminName: ' ', username: 'a b', password: 'corta', peyApiKey: 'con espacio' }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        businessName: 'El nombre del negocio debe tener de 1 a 30 caracteres',
        adminName: 'Escribe tu nombre',
        username: 'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo',
        password: 'La contraseña debe tener entre 8 y 200 caracteres',
        peyApiKey: 'Escribe la API key de pey de tu negocio',
      },
    });
  });
});
