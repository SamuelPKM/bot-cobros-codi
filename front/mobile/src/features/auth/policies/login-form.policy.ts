export interface LoginInput {
  username: string;
  password: string;
}

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export type ParsedLoginForm =
  | { ok: true; data: LoginInput }
  | { ok: false; fieldErrors: LoginFieldErrors };

/** Valida Entrar con las mismas reglas que la API (LoginDto). */
export function parseLoginForm(input: LoginInput): ParsedLoginForm {
  const username = input.username.trim();
  const { password } = input;
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
