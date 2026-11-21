import { field, type Parsed } from '@/shared/forms/form-state.type';

export type RegisterField = 'businessName' | 'adminName' | 'username' | 'password' | 'peyApiKey';

export interface RegisterInput {
  businessName: string;
  adminName: string;
  username: string;
  password: string;
  peyApiKey: string;
}

const USERNAME = /^[A-Za-z0-9._-]{3,30}$/;

/** Mismas reglas que RegisterBusinessDto de la API, para avisar antes de enviar. */
export function parseRegisterForm(form: FormData): Parsed<RegisterField, RegisterInput> {
  const data: RegisterInput = {
    businessName: field(form, 'businessName'),
    adminName: field(form, 'adminName'),
    username: field(form, 'username'),
    password: String(form.get('password') ?? ''),
    peyApiKey: field(form, 'peyApiKey'),
  };
  const errors: Partial<Record<RegisterField, string>> = {};

  if (!data.businessName || data.businessName.length > 30)
    errors.businessName = 'El nombre del negocio debe tener de 1 a 30 caracteres';
  if (!data.adminName || data.adminName.length > 80) errors.adminName = 'Escribe tu nombre';
  if (!USERNAME.test(data.username))
    errors.username = 'El usuario debe tener de 3 a 30 letras, números, punto, guion o guion bajo';
  if (data.password.length < 8 || data.password.length > 200)
    errors.password = 'La contraseña debe tener entre 8 y 200 caracteres';
  if (data.peyApiKey.length < 8 || data.peyApiKey.length > 300 || /\s/.test(data.peyApiKey))
    errors.peyApiKey = 'Escribe la API key de pey de tu negocio';

  return Object.keys(errors).length > 0 ? { ok: false, fieldErrors: errors } : { ok: true, data };
}
