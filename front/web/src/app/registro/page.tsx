import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/features/businesses/components/register-form';
import { AuthShell } from '@/shared/ui/auth-shell';

export const metadata: Metadata = { title: 'Registra tu negocio · Cóbrale' };

export default function RegistroPage() {
  return (
    <AuthShell
      title="Registra tu negocio"
      subtitle="Cobras con tu propia cuenta de pey: los pagos llegan directo a ella. Después invitas a tu equipo."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/entrar" className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm />
      <p className="mt-4 text-xs text-zinc-500">
        Al crear tu cuenta aceptas el{' '}
        <Link href="/privacidad" className="underline hover:text-zinc-700">
          aviso de privacidad
        </Link>
        .
      </p>
    </AuthShell>
  );
}
