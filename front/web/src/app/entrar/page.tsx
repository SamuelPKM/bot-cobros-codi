import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/login-form';
import { AuthShell } from '@/shared/ui/auth-shell';

export const metadata: Metadata = { title: 'Entrar · Cóbrale' };

export default function EntrarPage() {
  return (
    <AuthShell
      title="Qué gusto verte"
      subtitle="Entra con el usuario que te dio tu negocio."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link href="/registro" className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
            Registra tu negocio
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
