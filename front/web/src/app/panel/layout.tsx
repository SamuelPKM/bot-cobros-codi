import Link from 'next/link';
import { Suspense } from 'react';
import { logout } from '@/features/auth/actions/logout.action';
import { getCurrentUser } from '@/features/auth/services/current-user.service';
import { Logo } from '@/shared/ui/logo';

export default function PanelLayout({ children }: LayoutProps<'/panel'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200">
        <nav className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/panel" aria-label="Cóbrale, inicio del panel">
            <Logo size={30} />
          </Link>
          <Link href="/panel/cobros/nuevo" className="font-medium text-emerald-800">
            Nuevo cobro
          </Link>
          {/* Leen la sesión: dentro de Suspense para no detener el resto. */}
          <Suspense fallback={null}>
            <AdminLinks />
          </Suspense>
          <Link href="/panel/ajustes" className="font-medium text-emerald-800">
            Ajustes
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Suspense fallback={null}>
              <UserName />
            </Suspense>
            <form action={logout}>
              <button type="submit" className="font-medium text-emerald-800 underline">
                Salir
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">{children}</main>
    </div>
  );
}

async function AdminLinks() {
  const user = await getCurrentUser();
  if (user.role !== 'admin') return null;
  return (
    <Link href="/panel/equipo" className="font-medium text-emerald-800">
      Equipo
    </Link>
  );
}

async function UserName() {
  const user = await getCurrentUser();
  return (
    <span className="text-zinc-700">
      {user.name}
      {user.role === 'admin' ? ' · admin' : ''}
    </span>
  );
}
