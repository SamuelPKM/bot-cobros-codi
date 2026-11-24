import Link from 'next/link';
import { Logo } from '@/shared/ui/logo';
import { primaryButton, secondaryButton } from '@/shared/ui/styles';

export default function InicioPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1>
        <Logo size={56} />
      </h1>
      <p className="max-w-xl text-lg text-zinc-700">
        Cobra con CoDi desde el celular de tu cliente: le llega la solicitud a la app de su banco,
        con QR y liga de pago de respaldo. Tu equipo cobra sin ver tus cuentas.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/entrar" className={primaryButton}>
          Entrar
        </Link>
        <Link href="/demo" className={secondaryButton}>
          Probar la demo
        </Link>
      </div>
      <p className="text-xs text-zinc-500">
        No es un producto oficial de pey ni de Banco de México. ·{' '}
        <Link href="/privacidad" className="underline hover:text-zinc-700">
          Aviso de privacidad
        </Link>
      </p>
    </main>
  );
}
