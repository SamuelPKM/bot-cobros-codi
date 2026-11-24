export interface LoginFieldErrors {
  username?: string;
  password?: string;
}

/** Lo que la Server Action de Entrar le regresa al formulario. */
export interface LoginState {
  fieldErrors?: LoginFieldErrors;
  /** Error general (credenciales, cuenta desactivada, API caída). */
  formError?: string;
  /** Para no borrarle a la persona lo que ya escribió. */
  username?: string;
}
