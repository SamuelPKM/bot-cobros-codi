import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pago recibido · Cóbrale', robots: { index: false } };

/** A donde regresa pey a quien pagó con la liga (LINK_SUCCESS_PATH de la API). */
export default function PagoGraciasPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-16 text-center">
      <p className="text-5xl" aria-hidden="true">
        ✅
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900">¡Gracias por tu pago!</h1>
      <p className="text-zinc-700">
        Tu banco o pey te enviarán el comprobante. El negocio recibe el aviso en cuanto se confirma
        el pago; ya puedes cerrar esta página.
      </p>
    </main>
  );
}
