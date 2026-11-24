import { nameError, passwordError, usernameError } from '@/shared/forms/account-fields';
import { field, type Parsed } from '@/shared/forms/form-state.type';

export type RegisterField = 'businessName' | 'adminName' | 'username' | 'password' | 'peyApiKey';

export interface RegisterInput {
  businessName: string;
  adminName: string;
  username: string;
  password: string;
  peyApiKey: string;
}

/** Mismas reglas que RegisterBusinessDto de la API, para avisar antes de enviar. */
export function parseRegisterForm(form: FormData): Parsed<RegisterField, RegisterInput> {
  const data: RegisterInput = {
    businessName: field(form, 'businessName'),
    adminName: field(form, 'adminName'),
    username: field(form, 'username'),
    password: String(form.get('password') ?? ''),
    peyApiKey: field(form, 'peyApiKey'),
  };
  const errors: Partial<Record<RegisterField, string | undefined>> = {
    businessName:
      data.businessName && data.businessName.length <= 30
        ? undefined
        : 'El nombre del negocio debe tener de 1 a 30 caracteres',
    adminName: nameError(data.adminName, 'Escribe tu nombre'),
    username: usernameError(data.username),
    password: passwordError(data.password),
    peyApiKey:
      data.peyApiKey.length >= 8 && data.peyApiKey.length <= 300 && !/\s/.test(data.peyApiKey)
        ? undefined
        : 'Escribe la API key de pey de tu negocio',
  };
  const fieldErrors = Object.fromEntries(Object.entries(errors).filter(([, m]) => m)) as Partial<
    Record<RegisterField, string>
  >;
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, data };
}
