// Todos los textos del chat (WhatsApp y la demo), en un solo lugar.
// Regla: cada mensaje dice a quién se cobra, cuánto y por qué.

import type { DailySummary } from '../../reports/interfaces/report.interfaces';
import { CHARGE_EXAMPLE } from './command.parser';
import type { ChargeDescription } from '../interfaces/conversation.interfaces';

const pesos = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (cents: number): string => `$${pesos.format(cents / 100)}`;

export const formatPhone = (tenDigits: string): string =>
  `${tenDigits.slice(0, 2)} ${tenDigits.slice(2, 6)} ${tenDigits.slice(6)}`;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "$150.00 al 55 1234 5678 por "corte"". */
function describe(charge: ChargeDescription): string {
  const to = charge.payerPhone ? ` al ${formatPhone(charge.payerPhone)}` : '';
  const concept = charge.concept ? ` por "${charge.concept}"` : '';
  return `${money(charge.amountCents)}${to}${concept}`;
}

/** "liga 150 corte" para sugerir el plan B con el mismo monto y concepto. */
function linkCommand(charge: ChargeDescription): string {
  const amount =
    charge.amountCents % 100 === 0
      ? String(charge.amountCents / 100)
      : (charge.amountCents / 100).toFixed(2);
  return `liga ${amount}${charge.concept ? ` ${charge.concept}` : ''}`;
}

export const HELP = [
  'Esto es lo que puedo hacer:',
  '',
  `*${CHARGE_EXAMPLE}*`,
  'Manda un cobro CoDi al celular de tu cliente.',
  '',
  '*qr 150 corte de pelo*',
  'Te doy un QR para que tu cliente lo escanee con la app de su banco.',
  '',
  '*liga 150 corte de pelo*',
  'Te doy una liga de pago para reenviarla por donde quieras. Acepta CoDi y tarjeta.',
  '',
  '*liga*',
  'Liga de pago de tu último cobro pendiente, por si no le llegó a tu cliente.',
  '',
  '*resumen*',
  'Lo cobrado hoy y lo que sigue pendiente.',
].join('\n');

export const texts = {
  help: () => HELP,
  notUnderstood: () => `No entendí el mensaje.\n\n${HELP}`,
  onlyText: () => `Solo entiendo mensajes de texto.\n\n${HELP}`,
  alreadyLinked: () =>
    'Este WhatsApp ya está ligado a tu cuenta. Ya puedes cobrar desde aquí.',

  confirmPrompt: (draft: ChargeDescription) =>
    `Vas a cobrar ${describe(draft)}.\n\nResponde *sí* para enviarlo o *no* para cancelarlo.`,
  nothingToConfirm: () =>
    `No tienes ningún cobro por confirmar. Para crear uno escribe, por ejemplo: ${CHARGE_EXAMPLE}`,
  confirmationExpired: () =>
    'Ese cobro caducó porque pasaron más de 10 minutos sin confirmarlo. Vuelve a escribirlo para enviarlo.',
  cancelled: (draft: ChargeDescription) =>
    `Cancelado. No se envió el cobro de ${describe(draft)}.`,

  sent: (charge: ChargeDescription, minutes: number) =>
    `Listo, envié el cobro de ${describe(charge)}.\n\nTu cliente tiene ${minutes} minutos para aprobarlo en la app de su banco. Te aviso en cuanto pague.`,
  sendFailed: (charge: ChargeDescription, reason: string) =>
    `No se pudo enviar el cobro de ${describe(charge)}. ${reason}\n\nSi tu cliente no tiene CoDi activo, mándale una liga de pago, que también acepta tarjeta: *${linkCommand(charge)}*`,
  sendUnknown: (charge: ChargeDescription) =>
    `No pude confirmar si el cobro de ${describe(charge)} se envió, porque se cortó la conexión con el banco.\n\nNo lo repitas todavía: pregúntale a tu cliente si le llegó. Si paga, te aviso.`,

  qrCaption: (charge: ChargeDescription, minutes: number) =>
    `QR para cobrar ${describe(charge)}.\nTu cliente lo escanea con la app de su banco. Vence en ${minutes} minutos y te aviso en cuanto pague.`,
  link: (charge: ChargeDescription, url: string) =>
    `Esta es la liga para cobrar ${describe(charge)}. Mándasela a tu cliente por donde quieras:\n\n${url}\n\nPuede pagar con CoDi o con tarjeta. Te aviso en cuanto pague.`,
  noPendingCharge: () =>
    'No tienes ningún cobro pendiente de las últimas 24 horas. Para cobrar con liga escribe, por ejemplo: liga 150 corte de pelo',

  paid: (charge: ChargeDescription, trackingKey: string | null) =>
    `✅ Pagado: ${describe(charge)}.${trackingKey ? `\nClave de rastreo: ${trackingKey}` : ''}`,

  summary: (summary: DailySummary) => {
    if (
      summary.paid.count + summary.pending.count + summary.expired.count ===
      0
    ) {
      return 'Hoy todavía no hay cobros.';
    }
    const lines = [
      '*Resumen de hoy*',
      '',
      `Cobrado hoy: ${money(Math.round(summary.paid.amount * 100))} en ${plural(summary.paid.count, 'cobro', 'cobros')}`,
    ];
    if (summary.pending.count > 0)
      lines.push(
        `Pendientes: ${summary.pending.count} por ${money(Math.round(summary.pending.amount * 100))}`,
      );
    if (summary.expired.count > 0)
      lines.push(`Vencidos: ${summary.expired.count}`);
    for (const person of summary.byPerson ?? []) {
      if (person.paidCount + person.pendingCount === 0) continue;
      lines.push(
        `• ${person.name}: ${money(Math.round(person.paidAmount * 100))} (${plural(person.paidCount, 'cobro', 'cobros')})`,
      );
    }
    return lines.join('\n');
  },
};
