// Reglas de los campos de cuenta, iguales a los DTOs de la API (registro,
// alta de vendedor, aceptar invitación, editar persona).

const USERNAME = /^[A-Za-z0-9._-]{3,30}$/;

export const usernameError = (username: string): string | undefined =>
  USERNAME.test(username)
    ? undefined
    : 'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo';

export const passwordError = (password: string): string | undefined =>
  password.length >= 8 && password.length <= 200
    ? undefined
    : 'La contraseña debe tener entre 8 y 200 caracteres';

export const nameError = (name: string, message: string): string | undefined =>
  name && name.length <= 80 ? undefined : message;

export type ParsedPesos = { ok: true; value: number } | { ok: false; error: 'decimals' | 'positive' };

/** "$1,500.50" → 1500.5. Máximo 2 decimales y mayor a 0. */
export function parsePesos(text: string): ParsedPesos {
  const raw = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, error: 'decimals' };
  const value = Number(raw);
  return value > 0 ? { ok: true, value } : { ok: false, error: 'positive' };
}
