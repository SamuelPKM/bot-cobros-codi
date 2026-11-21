import { nameError, parsePesos, passwordError, usernameError } from '@/shared/forms/account-fields';
import { field, type Parsed } from '@/shared/forms/form-state.type';
import type { Role } from '@/shared/interfaces/public-user.interface';

const NAME_MESSAGE = 'Escribe el nombre de la persona';

function maxAmountError(result: ReturnType<typeof parsePesos>): string {
  return result.ok
    ? ''
    : result.error === 'positive'
      ? 'El tope debe ser mayor a 0'
      : 'El tope admite máximo 2 decimales';
}

export type NewSellerField = 'name' | 'username' | 'password' | 'maxAmount';

/** Cuerpo de POST /users (alta directa de un vendedor). */
export interface NewSellerInput {
  name: string;
  username: string;
  password: string;
  maxAmount?: number;
}

export function parseNewSeller(form: FormData): Parsed<NewSellerField, NewSellerInput> {
  const name = field(form, 'name');
  const username = field(form, 'username');
  const password = String(form.get('password') ?? '');
  const rawMax = field(form, 'maxAmount');
  const errors: Partial<Record<NewSellerField, string>> = {
    name: nameError(name, NAME_MESSAGE),
    username: usernameError(username),
    password: passwordError(password),
  };
  let maxAmount: number | undefined;
  if (rawMax) {
    const parsed = parsePesos(rawMax);
    if (parsed.ok) maxAmount = parsed.value;
    else errors.maxAmount = maxAmountError(parsed);
  }
  return finish(errors, { name, username, password, ...(maxAmount ? { maxAmount } : {}) });
}

export type MemberField = 'name' | 'role' | 'maxAmount' | 'password';

/** Cuerpo de PATCH /users/:id. maxAmount null quita el tope. */
export interface MemberUpdateInput {
  userId: number;
  body: {
    name: string;
    role: Role;
    active: boolean;
    maxAmount: number | null;
    password?: string;
  };
}

export function parseMemberUpdate(form: FormData): Parsed<MemberField, MemberUpdateInput> {
  const userId = Number(field(form, 'userId'));
  if (!Number.isInteger(userId) || userId <= 0)
    return { ok: false, fieldErrors: { name: 'No encontramos a esa persona' } };

  const name = field(form, 'name');
  const role = field(form, 'role');
  const password = String(form.get('password') ?? '');
  const rawMax = field(form, 'maxAmount');
  const errors: Partial<Record<MemberField, string>> = {
    name: nameError(name, NAME_MESSAGE),
    role: role === 'admin' || role === 'seller' ? undefined : 'El rol debe ser admin o vendedor',
    password: password ? passwordError(password) : undefined,
  };
  let maxAmount: number | null = null;
  if (rawMax) {
    const parsed = parsePesos(rawMax);
    if (parsed.ok) maxAmount = parsed.value;
    else errors.maxAmount = maxAmountError(parsed);
  }
  return finish(errors, {
    userId,
    body: {
      name,
      role: role as Role,
      active: form.get('active') === 'on',
      maxAmount,
      ...(password ? { password } : {}),
    },
  });
}

function finish<F extends string, D>(
  errors: Partial<Record<F, string | undefined>>,
  data: D,
): Parsed<F, D> {
  const fieldErrors = Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  ) as Partial<Record<F, string>>;
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, data };
}
