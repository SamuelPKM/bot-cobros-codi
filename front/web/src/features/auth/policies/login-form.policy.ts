import type { LoginFieldErrors } from '../types/login-state.type';

export interface LoginInput {
  username: string;
  password: string;
}

export type ParsedLoginForm =
  | { ok: true; data: LoginInput }
  | { ok: false; fieldErrors: LoginFieldErrors };

/** Valida el formulario de Entrar con las mismas reglas que la API (LoginDto). */
export function parseLoginForm(form: FormData): ParsedLoginForm {
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const fieldErrors: LoginFieldErrors = {};

  if (!username) fieldErrors.username = 'Escribe tu usuario';
  else if (username.length > 30) fieldErrors.username = 'El usuario tiene máximo 30 caracteres';

  if (!password) fieldErrors.password = 'Escribe tu contraseña';
  else if (password.length > 200)
    fieldErrors.password = 'La contraseña tiene máximo 200 caracteres';

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, data: { username, password } };
}
