import { describe, expect, it } from 'vitest';
import { parseLoginForm } from './login-form.policy';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe('parseLoginForm', () => {
  it('acepta usuario y contraseña, con el usuario sin espacios', () => {
    expect(parseLoginForm(form({ username: '  Ana ', password: 'secreta 1' }))).toEqual({
      ok: true,
      data: { username: 'Ana', password: 'secreta 1' },
    });
  });

  it('pide los dos campos', () => {
    expect(parseLoginForm(form({ username: ' ', password: '' }))).toEqual({
      ok: false,
      fieldErrors: { username: 'Escribe tu usuario', password: 'Escribe tu contraseña' },
    });
  });

  it('respeta los largos que acepta la API', () => {
    const result = parseLoginForm(form({ username: 'a'.repeat(31), password: 'x'.repeat(201) }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        username: 'El usuario tiene máximo 30 caracteres',
        password: 'La contraseña tiene máximo 200 caracteres',
      },
    });
  });
});
