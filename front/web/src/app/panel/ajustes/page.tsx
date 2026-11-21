import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getCurrentUser } from '@/features/auth/services/current-user.service';
import { BusinessSettings } from '@/features/businesses/components/business-settings';
import { getMyBusiness } from '@/features/businesses/services/business.service';
import { WhatsAppSettings } from '@/features/whatsapp/components/whatsapp-settings';
import { getWhatsAppLink } from '@/features/whatsapp/services/whatsapp.service';

export const metadata: Metadata = { title: 'Ajustes · Cóbrale' };

export default function AjustesPage() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Ajustes</h1>
      <Suspense fallback={<p className="text-zinc-600">Cargando…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const user = await getCurrentUser();
  const [link, business] = await Promise.all([
    getWhatsAppLink(),
    user.role === 'admin' ? getMyBusiness() : Promise.resolve(null),
  ]);
  return (
    <>
      <WhatsAppSettings link={link} />
      {business && <BusinessSettings business={business} />}
    </>
  );
}
