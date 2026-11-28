import { parseLoginForm } from './login-form.policy';

describe('parseLoginForm', () => {
  it('acepta usuario y contraseña, con el usuario sin espacios', () => {
    expect(parseLoginForm({ username: '  Ana ', password: 'secreta 1' })).toEqual({
      ok: true,
      data: { username: 'Ana', password: 'secreta 1' },
    });
  });

  it('pide los dos campos', () => {
    expect(parseLoginForm({ username: ' ', password: '' })).toEqual({
      ok: false,
      fieldErrors: { username: 'Escribe tu usuario', password: 'Escribe tu contraseña' },
    });
  });

  it('respeta los largos que acepta la API', () => {
    expect(parseLoginForm({ username: 'a'.repeat(31), password: 'x'.repeat(201) })).toEqual({
      ok: false,
      fieldErrors: {
        username: 'El usuario tiene máximo 30 caracteres',
        password: 'La contraseña tiene máximo 200 caracteres',
      },
    });
  });
});
