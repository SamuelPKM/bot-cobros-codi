import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ChargeDetail } from '@/features/charges/components/charge-detail';
import { getCharge } from '@/features/charges/services/charges.service';

export const metadata: Metadata = { title: 'Cobro · Cóbrale' };

export default function CobroPage({ params }: PageProps<'/panel/cobros/[id]'>) {
  return (
    <>
      <Link href="/panel" className="text-sm font-medium text-emerald-800 underline">
        ← Volver al panel
      </Link>
      <Suspense fallback={<p className="text-zinc-600">Cargando…</p>}>
        <Charge params={params} />
      </Suspense>
    </>
  );
}

async function Charge({ params }: { params: PageProps<'/panel/cobros/[id]'>['params'] }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ChargeDetail charge={await getCharge(id)} />;
}
