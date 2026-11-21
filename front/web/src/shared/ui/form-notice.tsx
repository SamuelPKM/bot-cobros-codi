/** Confirmación de que algo se guardó; el lector de pantalla la anuncia. */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      {message}
    </p>
  );
}
