import { nameError, passwordError, usernameError } from '@/shared/forms/account-fields';
import { field, type Parsed } from '@/shared/forms/form-state.type';

export type AcceptField = 'name' | 'username' | 'password';

export interface AcceptInput {
  name: string;
  username: string;
  password: string;
}

/** Mismas reglas que AcceptInvitationDto de la API. El rol lo pone la invitación. */
export function parseAcceptForm(form: FormData): Parsed<AcceptField, AcceptInput> {
  const data: AcceptInput = {
    name: field(form, 'name'),
    username: field(form, 'username'),
    password: String(form.get('password') ?? ''),
  };
  const errors = {
    name: nameError(data.name, 'Escribe tu nombre'),
    username: usernameError(data.username),
    password: passwordError(data.password),
  };
  const fieldErrors = Object.fromEntries(Object.entries(errors).filter(([, m]) => m)) as Partial<
    Record<AcceptField, string>
  >;
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, data };
}
