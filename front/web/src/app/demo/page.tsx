import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { DemoChat } from '@/features/demo/components/demo-chat';
import { getDemoInfo } from '@/features/demo/services/demo-info.service';
import { formatMoney } from '@/shared/format/format';

export const metadata: Metadata = {
  title: 'Demo · Cóbrale',
  description: 'Prueba Cóbrale sin cuenta: cobra con CoDi por push, QR o liga de pago.',
};

export default function DemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm font-medium text-emerald-800 underline">
          ← Cóbrale
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900">Prueba Cóbrale</h1>
      </div>
      <Suspense fallback={<p className="text-zinc-600">Cargando la demo…</p>}>
        <Demo />
      </Suspense>
    </main>
  );
}

async function Demo() {
  const info = await getDemoInfo();
  if (!info)
    return <p className="text-zinc-700">La demo no está disponible en este momento.</p>;
  return (
    <>
      <p className="text-sm text-zinc-700">
        Escribe como si fueras parte de <strong>{info.businessName}</strong>: es la misma conversación
        que por WhatsApp. <strong>Los cobros son reales</strong>, de hasta {formatMoney(info.maxAmount)}{' '}
        y {info.chargesPerHour} por hora; el dinero llega a la cuenta de {info.businessName}.
      </p>
      <DemoChat />
    </>
  );
}
