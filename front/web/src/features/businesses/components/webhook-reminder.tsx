import type { PublicBusiness } from '../interfaces/public-business.interface';

/**
 * Sin el webhook de pey los pagos se registran igual (el barrido consulta a pey),
 * pero tarda más. Al admin se le recuerda registrarlo.
 */
export function WebhookReminder({ business }: { business: PublicBusiness }) {
  if (business.webhookConfigured) return null;
  return (
    <aside className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-medium">Falta registrar el webhook de pey</p>
      <p>
        Para que los pagos se marquen al instante, en portal.mipey.mx registra esta URL y luego
        guarda el secreto (empieza con <code>whsec_</code>) en Ajustes:
      </p>
      <code className="break-all rounded bg-white px-2 py-1">{business.webhookUrl}</code>
    </aside>
  );
}
