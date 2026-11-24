import type { Metadata } from 'next';
import { NewChargeForm } from '@/features/charges/components/new-charge-form';

export const metadata: Metadata = { title: 'Nuevo cobro · Cóbrale' };

export default function NuevoCobroPage() {
  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Nuevo cobro</h1>
      <NewChargeForm />
    </div>
  );
}
