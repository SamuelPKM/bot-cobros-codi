import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Entrar · Cóbrale' };

export default function EntrarPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Entrar</h1>
        <p className="text-sm text-zinc-600">Con el usuario que te dio tu negocio.</p>
      </div>
      <LoginForm />
      <p className="text-sm text-zinc-600">
        ¿Aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-medium text-emerald-800 underline">
          Registra tu negocio
        </Link>
      </p>
    </main>
  );
}
