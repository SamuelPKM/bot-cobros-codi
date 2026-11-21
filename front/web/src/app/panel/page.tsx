import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentUser } from '@/features/auth/services/current-user.service';
import { WebhookReminder } from '@/features/businesses/components/webhook-reminder';
import { getMyBusiness } from '@/features/businesses/services/business.service';
import { ChargesTable } from '@/features/charges/components/charges-table';
import { listCharges } from '@/features/charges/services/charges.service';
import { CsvDownloadForm } from '@/features/reports/components/csv-download-form';
import { TodaySummary } from '@/features/reports/components/today-summary';
import { getTodaySummary } from '@/features/reports/services/reports.service';
import { primaryButton } from '@/shared/ui/styles';

export const metadata: Metadata = { title: 'Panel · Cóbrale' };

export default function PanelPage() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Panel</h1>
        <Link href="/panel/cobros/nuevo" className={primaryButton}>
          Nuevo cobro
        </Link>
      </div>
      <Suspense fallback={<p className="text-zinc-600">Cargando…</p>}>
        <PanelContent />
      </Suspense>
    </>
  );
}

async function PanelContent() {
  const user = await getCurrentUser();
  const isAdmin = user.role === 'admin';
  const [summary, charges, business] = await Promise.all([
    getTodaySummary(),
    listCharges(),
    isAdmin ? getMyBusiness() : Promise.resolve(null),
  ]);

  return (
    <>
      {business && <WebhookReminder business={business} />}
      <TodaySummary summary={summary} />
      <section aria-labelledby="charges-title" className="flex flex-col gap-3">
        <h2 id="charges-title" className="text-lg font-semibold text-zinc-900">
          {isAdmin ? 'Cobros del negocio' : 'Tus cobros'}
        </h2>
        <ChargesTable charges={charges} showSeller={isAdmin} />
        <CsvDownloadForm />
      </section>
    </>
  );
}
