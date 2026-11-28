import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { messageFor } from '@/shared/api/error-message';
import { formatDateTime, formatMoney, formatPhone, formatTime } from '@/shared/format/format';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { fonts, palette, radius, spacing } from '@/shared/ui/theme';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { activeLink, activeQr, isWaitingPayment, kindLabel } from '../policies/charge-view.policy';
import { ChargeStatusBadge } from './charge-status-badge';
import { QrCode } from './qr-code';

interface ChargeDetailProps {
  charge: PublicCharge;
  /** Plan B del mismo cobro; la pantalla pone el cobro que devuelva la API. */
  onFallback: (kind: 'qr' | 'link') => Promise<void>;
}

export function ChargeDetail({ charge, onFallback }: ChargeDetailProps) {
  const [busy, setBusy] = useState<'qr' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waiting = isWaitingPayment(charge);
  const qr = activeQr(charge);
  const link = activeLink(charge);
  const problems = charge.attempts.filter((a) => a.error);

  async function fallback(kind: 'qr' | 'link') {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await onFallback(kind);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(null);
    }
  }

  const shareLink = (url: string) =>
    Share.share({
      message: `Paga ${formatMoney(charge.amount)}${charge.concept ? ` (${charge.concept})` : ''} aquí: ${url}`,
    }).catch(() => undefined);

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <ChargeStatusBadge status={charge.status} />
        <Text style={[styles.amount, { color: palette.text }]}>{formatMoney(charge.amount)}</Text>
        {charge.tip > 0 ? (
          <Text style={[styles.line, { color: palette.muted }]}>
            {`Cobro ${formatMoney(charge.subtotal)} · Propina ${formatMoney(charge.tip)}`}
          </Text>
        ) : null}
        {charge.concept ? <Text style={[styles.line, { color: palette.text }]}>{charge.concept}</Text> : null}
        <Text style={[styles.line, { color: palette.muted }]}>
          {[charge.payerPhone ? formatPhone(charge.payerPhone) : null, charge.seller.name, formatDateTime(charge.createdAt)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {charge.status === 'paid' ? (
        <View style={[styles.card, { backgroundColor: palette.successSurface, borderColor: palette.successBorder }]}>
          <Text style={[styles.paid, { color: palette.success }]}>✅ Pagado</Text>
          {charge.paidVia && charge.paidAt ? (
            <Text style={[styles.line, { color: palette.success }]}>
              {`${kindLabel(charge.paidVia)} · ${formatDateTime(charge.paidAt)}`}
            </Text>
          ) : null}
        </View>
      ) : waiting ? (
        <Text accessibilityLiveRegion="polite" style={[styles.line, { color: palette.muted }]}>
          Esperando el pago… La pantalla cambia sola cuando llegue.
        </Text>
      ) : null}

      {waiting && problems.length
        ? problems.map((attempt) => (
            <Notice key={attempt.id} message={`${kindLabel(attempt.kind)}: ${attempt.error}`} tone="info" />
          ))
        : null}

      {qr ? (
        <View style={[styles.card, styles.center, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <QrCode value={qr.qrString} />
          {qr.expiresAt ? (
            <Text style={[styles.line, { color: palette.muted }]}>{`Vence a las ${formatTime(qr.expiresAt)}`}</Text>
          ) : null}
        </View>
      ) : null}

      {link ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text selectable style={[styles.link, { color: palette.text }]}>
            {link}
          </Text>
          <Button label="Compartir liga" variant="secondary" onPress={() => void shareLink(link)} />
        </View>
      ) : null}

      {error ? <Notice message={error} /> : null}

      {waiting && (!qr || !link) ? (
        <View style={styles.fallbacks}>
          <Text style={[styles.line, { color: palette.muted }]}>¿No le llegó? Es el mismo cobro, no se cobra dos veces:</Text>
          {!qr ? (
            <Button label="Mostrar QR" variant="secondary" busy={busy === 'qr'} disabled={busy !== null} onPress={() => void fallback('qr')} />
          ) : null}
          {!link ? (
            <Button label="Liga de pago" variant="secondary" busy={busy === 'link'} disabled={busy !== null} onPress={() => void fallback('link')} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  center: { alignItems: 'center' },
  amount: { fontFamily: fonts.semibold, fontSize: 32, fontVariant: ['tabular-nums'] },
  line: { fontFamily: fonts.regular, fontSize: 14 },
  paid: { fontFamily: fonts.semibold, fontSize: 20 },
  link: { fontFamily: fonts.regular, fontSize: 14 },
  fallbacks: { gap: spacing.sm },
});
