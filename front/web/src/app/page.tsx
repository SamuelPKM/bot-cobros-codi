import Link from 'next/link';

export default function InicioPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold text-zinc-900">Cóbrale</h1>
      <p className="max-w-xl text-lg text-zinc-700">
        Cobra con CoDi desde el celular de tu cliente: le llega la solicitud a la app de su banco,
        con QR y liga de pago de respaldo. Tu equipo cobra sin ver tus cuentas.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/entrar" className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">
          Entrar
        </Link>
        <Link href="/demo" className="rounded-md border border-zinc-300 px-4 py-2 font-medium text-zinc-900 hover:bg-zinc-50">
          Probar la demo
        </Link>
      </div>
      <p className="text-xs text-zinc-500">No es un producto oficial de pey ni de Banco de México.</p>
    </main>
  );
}
