import { useId, type SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
}

/** Lista desplegable con etiqueta y error accesibles. */
export function SelectField({ label, options, error, id, ...select }: SelectFieldProps) {
  const generated = useId();
  const selectId = id ?? generated;
  const errorId = `${selectId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-emerald-600"
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
