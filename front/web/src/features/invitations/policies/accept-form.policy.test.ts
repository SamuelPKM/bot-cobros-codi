import { describe, expect, it } from 'vitest';
import { parseAcceptForm } from './accept-form.policy';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe('parseAcceptForm', () => {
  it('nombre, usuario y contraseña de quien acepta', () => {
    expect(parseAcceptForm(form({ name: ' Leo ', username: 'leo', password: 'segura-123' }))).toEqual({
      ok: true,
      data: { name: 'Leo', username: 'leo', password: 'segura-123' },
    });
  });

  it('valida como la API', () => {
    expect(parseAcceptForm(form({ name: '', username: 'l', password: 'x' }))).toEqual({
      ok: false,
      fieldErrors: {
        name: 'Escribe tu nombre',
        username: 'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo',
        password: 'La contraseña debe tener entre 8 y 200 caracteres',
      },
    });
  });
});
