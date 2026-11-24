import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pago no realizado · Cóbrale', robots: { index: false } };

/** A donde regresa pey si quien iba a pagar se salió (LINK_BACK_PATH de la API). */
export default function PagoCanceladoPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">No se hizo ningún cargo</h1>
      <p className="text-zinc-700">
        Saliste antes de pagar. Si quieres intentarlo otra vez, vuelve a abrir la liga que te
        mandaron; sigue vigente hasta que vence.
      </p>
    </main>
  );
}
