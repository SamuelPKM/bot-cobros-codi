import { secondaryButton } from '@/shared/ui/styles';

/**
 * Descargar los cobros en CSV (Excel). Formulario GET normal: el navegador
 * baja el archivo de /panel/cobros/csv. Sin fechas, los de hoy; hasta 93 días.
 */
export function CsvDownloadForm() {
  return (
    <form action="/panel/cobros/csv" method="get" className="flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium text-zinc-800">Desde</span>
        <input type="date" name="from" className="rounded-md border border-zinc-300 px-2 py-1.5" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-zinc-800">Hasta</span>
        <input type="date" name="to" className="rounded-md border border-zinc-300 px-2 py-1.5" />
      </label>
      <button type="submit" className={secondaryButton}>
        Descargar CSV
      </button>
      <span className="text-zinc-600">Sin fechas: los de hoy. Hasta 93 días.</span>
    </form>
  );
}
