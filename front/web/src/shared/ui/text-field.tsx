import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  /** Mensaje de error del campo; lo anuncia el lector de pantalla. */
  error?: string;
}

/** Campo de texto con etiqueta y error accesibles. */
export function TextField({ label, error, id, className, ...input }: TextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-md border px-3 py-2 text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-600 ${
          error ? 'border-red-600' : 'border-zinc-300'
        } ${className ?? ''}`}
        {...input}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
