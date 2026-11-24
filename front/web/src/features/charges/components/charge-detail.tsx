import { formatDateTime, formatMoney, formatPhone } from '@/shared/format/format';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { activeLink, activeQr, isWaitingPayment, kindLabel } from '../policies/charge-view.policy';
import { qrDataUrl } from '../services/qr-image.service';
import { ChargeStatusBadge } from './charge-status-badge';
import { ChargeStatusPoller } from './charge-status-poller';
import { CopyButton } from '@/shared/ui/copy-button';
import { FallbackButtons } from './fallback-buttons';

/** Un cobro: estado, QR o liga vigentes, plan B y avisos de cada intento. */
export async function ChargeDetail({ charge }: { charge: PublicCharge }) {
  const waiting = isWaitingPayment(charge);
  const qr = activeQr(charge);
  const link = activeLink(charge);
  const qrImage = qr ? await qrDataUrl(qr.qrString) : null;
  const problems = charge.attempts.filter((a) => a.error);

  return (
    <div className="flex flex-col gap-6">
      <ChargeStatusPoller active={waiting} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-semibold tabular-nums">{formatMoney(charge.amount)}</span>
          <ChargeStatusBadge status={charge.status} />
        </div>
        <p className="text-zinc-700">
          {charge.concept ?? 'Sin concepto'} · Cliente {formatPhone(charge.payerPhone)} · Cobró{' '}
          {charge.seller.name}
        </p>
        <p className="text-sm text-zinc-600">Creado el {formatDateTime(charge.createdAt)}</p>
        {charge.status === 'paid' && charge.paidAt && (
          <p className="font-medium text-emerald-800" role="status">
            ✅ Pagado el {formatDateTime(charge.paidAt)}
            {charge.paidVia ? ` (${kindLabel(charge.paidVia)})` : ''}
          </p>
        )}
        {waiting && (
          <p className="text-sm text-zinc-600" role="status">
            Esperando el pago… esta pantalla se actualiza sola.
          </p>
        )}
      </div>

      {qrImage && (
        <section className="flex flex-col items-start gap-2">
          <h2 className="font-semibold">QR para escanear</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generada en el servidor */}
          <img
            src={qrImage}
            alt={`QR CoDi para pagar ${formatMoney(charge.amount)}`}
            width={240}
            height={240}
            className="rounded-lg border border-zinc-200"
          />
          {qr?.expiresAt && (
            <p className="text-sm text-zinc-600">Vence a las {formatDateTime(qr.expiresAt)}</p>
          )}
        </section>
      )}

      {link && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Liga de pago</h2>
          <p className="break-all rounded bg-zinc-50 px-3 py-2 text-sm">{link}</p>
          <div>
            <CopyButton text={link} />
          </div>
        </section>
      )}

      {waiting && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">¿No le llegó a tu cliente?</h2>
          <FallbackButtons chargeId={charge.id} />
        </section>
      )}

      {problems.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-semibold">Avisos</h2>
          <ul className="list-disc pl-5 text-zinc-700">
            {problems.map((a) => (
              <li key={a.id}>
                {kindLabel(a.kind)}: {a.error}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
