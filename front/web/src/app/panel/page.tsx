import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getCurrentUser } from '@/features/auth/services/current-user.service';
import { BusinessHeader } from '@/features/businesses/components/business-header';
import { WebhookReminder } from '@/features/businesses/components/webhook-reminder';
import { getMyBusiness } from '@/features/businesses/services/business.service';
import { ChargesTable } from '@/features/charges/components/charges-table';
import { listCharges } from '@/features/charges/services/charges.service';
import { CsvDownloadForm } from '@/features/reports/components/csv-download-form';
import { PeriodOverview } from '@/features/reports/components/period-overview';
import { TodaySummary } from '@/features/reports/components/today-summary';
import {
  getOverview,
  getTodaySummary,
  parseOverviewDays,
} from '@/features/reports/services/reports.service';

export const metadata: Metadata = { title: 'Panel · Cóbrale' };

export default function PanelPage({ searchParams }: PageProps<'/panel'>) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PanelContent({ searchParams }: Pick<PageProps<'/panel'>, 'searchParams'>) {
  const days = parseOverviewDays((await searchParams).dias);
  // El saludo y la fecha dependen de la hora: se calculan en cada visita.
  await connection();
  const now = new Date();
  const user = await getCurrentUser();
  const isAdmin = user.role === 'admin';
  const [summary, overview, charges, business] = await Promise.all([
    getTodaySummary(),
    getOverview(days),
    listCharges(),
    isAdmin ? getMyBusiness() : Promise.resolve(null),
  ]);

  return (
    <>
      <BusinessHeader businessName={overview.businessName} userName={user.name} role={user.role} now={now} />
      {business && <WebhookReminder business={business} />}
      <TodaySummary summary={summary} />
      <PeriodOverview overview={overview} />
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

/** Mientras carga: la forma del panel, sin datos. */
function PanelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el panel" className="flex animate-pulse flex-col gap-6">
      <div className="h-32 rounded-2xl bg-emerald-950/90" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-zinc-100" />
        <div className="h-24 rounded-xl bg-zinc-100" />
        <div className="h-24 rounded-xl bg-zinc-100" />
      </div>
      <div className="h-64 rounded-xl bg-zinc-100" />
    </div>
  );
}
