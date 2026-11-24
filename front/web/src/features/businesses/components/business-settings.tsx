import { CopyButton } from '@/shared/ui/copy-button';
import type { PublicBusiness } from '../interfaces/public-business.interface';
import { BusinessSettingForm } from './business-setting-form';
import { LogoSettings } from './logo-settings';

/** Ajustes del negocio (solo admin): nombre, API key de pey y webhook. */
export function BusinessSettings({ business }: { business: PublicBusiness }) {
  return (
    <section aria-labelledby="business-title" className="flex flex-col gap-6">
      <h2 id="business-title" className="text-lg font-semibold text-zinc-900">
        Negocio
      </h2>

      <LogoSettings
        businessName={business.name}
        logoVersion={business.logoVersion}
        enabled={business.logosEnabled}
      />

      <BusinessSettingForm
        section="name"
        field="name"
        label="Nombre del negocio"
        defaultValue={business.name}
        hint="Es lo que ve tu cliente en la solicitud de pago de su banco."
        submitLabel="Guardar nombre"
      />

      <BusinessSettingForm
        section="apiKey"
        field="peyApiKey"
        label={`API key de pey (la actual termina en …${business.peyApiKeyLast4})`}
        secret
        hint="Solo si la cambiaste en portal.mipey.mx. La verificamos con pey antes de guardarla."
        submitLabel="Reemplazar API key"
      />

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-zinc-900">Webhook de pey</h3>
        <p className="text-sm text-zinc-700">
          {business.webhookConfigured
            ? '✅ Registrado: los pagos se marcan en cuanto pey avisa.'
            : 'Aún no registrado: los pagos se marcan cuando el barrido consulta a pey (tarda más).'}
        </p>
        <p className="text-sm text-zinc-700">
          1. En portal.mipey.mx, en tu API key → Crear webhook, registra esta URL:
        </p>
        <p className="break-all rounded bg-zinc-50 px-3 py-2 text-sm">{business.webhookUrl}</p>
        <div>
          <CopyButton text={business.webhookUrl} label="Copiar URL" />
        </div>
        <p className="text-sm text-zinc-700">2. Pega aquí el secreto que te da pey:</p>
        <BusinessSettingForm
          section="webhook"
          field="peyWebhookSecret"
          label="Secreto del webhook (whsec_…)"
          secret
          submitLabel="Guardar secreto"
        />
      </div>
    </section>
  );
}
