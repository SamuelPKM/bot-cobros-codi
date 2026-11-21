import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/features/businesses/components/register-form';

export const metadata: Metadata = { title: 'Registra tu negocio · Cóbrale' };

export default function RegistroPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Registra tu negocio</h1>
        <p className="text-sm text-zinc-600">
          Cobras con tu propia cuenta de pey: los pagos llegan directo a ella. Después invitas a tu
          equipo.
        </p>
      </div>
      <RegisterForm />
      <p className="text-sm text-zinc-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/entrar" className="font-medium text-emerald-800 underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
