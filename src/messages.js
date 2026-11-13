// Todos los textos que ve el comerciante, en un solo lugar.
// Regla: cada mensaje dice a quién se cobra, cuánto y por qué.

export function money(cents) {
  return `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function phone(tenDigits) {
  return `${tenDigits.slice(0, 2)} ${tenDigits.slice(2, 6)} ${tenDigits.slice(6)}`;
}

function describe(charge) {
  const concept = charge.concept ? ` por "${charge.concept}"` : '';
  return `${money(charge.amountCents)} al ${phone(charge.payerPhone)}${concept}`;
}

/**
 * Concepto que ve quien paga en la app de su banco. Incluye el nombre del
 * negocio, porque el banco solo muestra al titular de la cuenta receptora.
 */
export function payerConcept(merchantName, concept, maxLength = 40) {
  const full = concept ? `${merchantName}: ${concept}` : merchantName;
  return full.length > maxLength ? full.slice(0, maxLength).trimEnd() : full;
}

export const HELP = [
  'Esto es lo que puedo hacer:',
  '',
  '*cobra 150 a 5512345678 corte de pelo*',
  'Manda un cobro CoDi al celular de tu cliente.',
  '',
  '*resumen*',
  'Lo cobrado hoy y lo que sigue pendiente.',
  '',
  '*liga*',
  'Genera una liga de pago si tu último cobro expiró.',
].join('\n');

export const texts = {
  help: () => HELP,

  notUnderstood: () => `No entendí el mensaje.\n\n${HELP}`,

  notRegistered: () =>
    'Este número no está registrado como comerciante, así que no puedo mandar cobros desde aquí.',

  onlyText: () => `Solo entiendo mensajes de texto.\n\n${HELP}`,

  confirmPrompt: (charge) =>
    [
      `Vas a cobrar ${describe(charge)}.`,
      '',
      'Responde *sí* para enviarlo o *no* para cancelarlo.',
    ].join('\n'),

  nothingToConfirm: () =>
    'No tienes ningún cobro por confirmar. Para crear uno escribe, por ejemplo: cobra 150 a 5512345678 corte de pelo',

  confirmationExpired: () =>
    'Ese cobro ya caducó porque pasaron más de 10 minutos sin confirmarlo. Vuelve a escribirlo para enviarlo.',

  cancelled: (charge) => `Cancelado. No se envió el cobro de ${describe(charge)}.`,

  sent: (charge, minutes) =>
    [
      `Listo, envié el cobro de ${describe(charge)}.`,
      '',
      `Tu cliente tiene ${minutes} minutos para aprobarlo en la app de su banco. Te aviso en cuanto pague.`,
    ].join('\n'),

  sendFailed: (charge, reason) => `No se pudo enviar el cobro de ${describe(charge)}. ${reason}`,

  sendUnknown: (charge) =>
    [
      `No pude confirmar si el cobro de ${describe(charge)} se envió, porque se cortó la conexión con el banco.`,
      '',
      'No lo repitas todavía: pregúntale a tu cliente si le llegó. Si paga, te aviso.',
    ].join('\n'),

  paid: (charge) =>
    [
      `✅ Pagado: ${describe(charge)}.`,
      charge.trackingKey ? `Clave de rastreo: ${charge.trackingKey}` : null,
    ]
      .filter(Boolean)
      .join('\n'),

  expired: (charge, canLink) =>
    [
      `⏰ El cobro de ${describe(charge)} expiró sin pagarse.`,
      '',
      canLink
        ? 'Responde *liga* y te mando una liga de pago para que se la reenvíes, o vuelve a escribir el cobro para intentarlo otra vez.'
        : 'Vuelve a escribir el cobro para intentarlo otra vez.',
    ].join('\n'),

  noExpiredCharge: () => 'No tienes ningún cobro expirado reciente para el que pueda generar una liga.',

  linkUnavailable: () => 'Las ligas de pago todavía no están configuradas en este bot.',

  link: (charge) =>
    [
      `Esta es la liga para cobrar ${describe(charge)}. Reenvíasela a tu cliente:`,
      '',
      charge.linkUrl,
      '',
      'Te aviso en cuanto pague.',
    ].join('\n'),

  linkFailed: (charge) => `No pude generar la liga para el cobro de ${describe(charge)}. Intenta de nuevo en un momento.`,

  summary: ({ paid, pending, expiredCount }) => {
    if (paid.length === 0 && pending.length === 0 && expiredCount === 0) {
      return 'Hoy todavía no has enviado cobros.';
    }
    const total = paid.reduce((sum, charge) => sum + charge.amountCents, 0);
    const lines = [`*Resumen de hoy*`, '', `Cobrado: ${money(total)} en ${plural(paid.length, 'cobro', 'cobros')}`];
    if (pending.length > 0) {
      lines.push('', `Pendientes (${pending.length}):`);
      for (const charge of pending) lines.push(`• ${describe(charge)}`);
    }
    if (expiredCount > 0) lines.push('', `Expirados sin pagar: ${expiredCount}`);
    return lines.join('\n');
  },
};

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Traduce el tipo de error de pey a algo que el comerciante pueda entender. */
export function peyErrorReason(error) {
  switch (error?.type) {
    case 'INVALID_STATE':
      return 'La cuenta bancaria que recibe los pagos todavía no está activa en CoDi.';
    case 'INVALID_AMOUNT':
      return 'El banco no aceptó ese monto.';
    case 'INVALID_PARAMETER':
    case 'INCOMPLETE_PARAMETERS':
    case 'BAD_REQUEST':
    case 'INVALID_REQUEST':
      return 'El banco no aceptó los datos del cobro. Revisa el teléfono y el monto.';
    case 'SERVICE_UNAVAILABLE':
    case 'FLAGS_UNAVAILABLE':
      return 'El servicio de cobros está en mantenimiento. Intenta de nuevo en unos minutos.';
    default:
      return 'Intenta de nuevo en unos minutos.';
  }
}
