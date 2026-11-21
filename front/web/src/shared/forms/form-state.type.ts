/**
 * Lo que una Server Action le regresa a su formulario (useActionState).
 * `values` conserva lo que la persona escribió (nunca contraseñas ni llaves).
 */
export interface FormState<Field extends string> {
  fieldErrors?: Partial<Record<Field, string>>;
  formError?: string;
  values?: Partial<Record<Field, string>>;
}

export type Parsed<Field extends string, Data> =
  | { ok: true; data: Data }
  | { ok: false; fieldErrors: Partial<Record<Field, string>> };

/** Texto del campo, sin espacios a los lados. */
export const field = (form: FormData, name: string): string =>
  String(form.get(name) ?? '').trim();

/** Mensaje genérico cuando el error no viene de la API. */
export const UNEXPECTED_ERROR = 'Algo salió mal. Intenta de nuevo en un momento.';
