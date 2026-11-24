import type { PublicCharge } from '../interfaces/public-charge.interface';
import type { AttemptKind, ChargeStatus } from '../types/charge.types';

const STATUS_LABELS: Record<ChargeStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

const KIND_LABELS: Record<AttemptKind, string> = {
  push: 'Push al celular',
  qr: 'QR',
  link: 'Liga de pago',
};

export const statusLabel = (status: ChargeStatus): string => STATUS_LABELS[status];
export const kindLabel = (kind: AttemptKind): string => KIND_LABELS[kind];

/** Mientras siga pendiente, la pantalla vuelve a preguntar si ya se pagó. */
export const isWaitingPayment = (charge: PublicCharge): boolean => charge.status === 'pending';

/** El último intento vigente de ese tipo, solo si el cobro sigue pendiente. */
function latestPending(charge: PublicCharge, kind: AttemptKind) {
  if (charge.status !== 'pending') return null;
  return charge.attempts.filter((a) => a.kind === kind && a.status === 'pending').at(-1) ?? null;
}

export function activeQr(charge: PublicCharge): { qrString: string; expiresAt: string | null } | null {
  const attempt = latestPending(charge, 'qr');
  return attempt?.qrString ? { qrString: attempt.qrString, expiresAt: attempt.expiresAt } : null;
}

export function activeLink(charge: PublicCharge): string | null {
  return latestPending(charge, 'link')?.linkUrl ?? null;
}
