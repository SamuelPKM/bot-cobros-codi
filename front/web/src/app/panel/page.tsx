import type { Metadata } from 'next';
import { Suspense } from 'react';
import { logout } from '@/features/auth/actions/logout.action';
import { getCurrentUser } from '@/features/auth/services/current-user.service';

export const metadata: Metadata = { title: 'Panel · Cóbrale' };

export default function PanelPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Panel</h1>
      {/* Lee la sesión: va dentro de Suspense para no bloquear el resto de la página. */}
      <Suspense fallback={<p className="text-zinc-600">Cargando…</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-zinc-800">
        Hola, <span className="font-medium">{user.name}</span>
        {user.role === 'admin' ? ' (administrador)' : ''}
      </p>
      <form action={logout}>
        <button type="submit" className="text-sm font-medium text-emerald-800 underline">
          Salir
        </button>
      </form>
    </div>
  );
}
