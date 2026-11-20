// Todos los textos que ve el comerciante, en un solo lugar.
// Regla: cada mensaje dice a quién se cobra, cuánto y por qué.

export function money(cents) {
  return `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function phone(tenDigits) {
  return `${tenDigits.slice(0, 2)} ${tenDigits.slice(2, 6)} ${tenDigits.slice(6)}`;
}

/** El comando para cobrar lo mismo con liga: "liga 150 corte de pelo" o "liga 80.50". */
function linkCommand(charge) {
  const cents = charge.amountCents;
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `liga ${amount}${charge.concept ? ` ${charge.concept}` : ''}`;
}

/** "$150.00 por "corte"": para textos que ya dicen si es QR o liga. */
function amountAndConcept(charge) {
  return `${money(charge.amountCents)}${charge.concept ? ` por "${charge.concept}"` : ''}`;
}

function describe(charge) {
  const concept = charge.concept ? ` por "${charge.concept}"` : '';
  let target = '';
  if (charge.payerPhone) target = ` al ${phone(charge.payerPhone)}`;
  else if (charge.kind === 'qr') target = ' con QR';
  else if (charge.kind === 'link') target = ' con liga de pago';
  return `${money(charge.amountCents)}${target}${concept}`;
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
  '*liga 150 corte de pelo*',
  'Te doy una liga de pago para que se la mandes a tu cliente por donde quieras. No necesito su teléfono.',
  '',
  '*qr 150 corte de pelo*',
  'Te doy un código QR para que tu cliente lo escanee con la app de su banco.',
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

  notRegistered: (webUrl) =>
    webUrl
      ? `Este número todavía no está ligado a una cuenta de Cóbrale. Crea tu cuenta en ${webUrl} y, en Ajustes, sigue los pasos para ligar tu WhatsApp.`
      : 'Este número todavía no está ligado a una cuenta de Cóbrale.',

  linked: (user, merchant) =>
    `Listo, ${user.name}: este WhatsApp quedó ligado a *${merchant.businessName}*${user.role === 'admin' ? ' como administrador' : ''}. Ya puedes cobrar desde aquí.\n\n${HELP}`,

  linkCodeInvalid: () => 'Ese código no es válido o ya venció. Genera uno nuevo en Ajustes de tu cuenta de Cóbrale.',

  invalidClabe: () => 'La CLABE no es válida: deben ser 18 dígitos y el último es un dígito verificador. Revísala en tu estado de cuenta.',

  missingHolder: () => 'Escribe el nombre del titular de la cuenta, tal como aparece en el banco.',

  missingEntity: () => 'Elige si la cuenta es de una persona física o de una empresa.',

  bankRegistered: () =>
    'Listo, registramos tu CLABE. Banxico la valida en hasta 5 días hábiles; mientras tanto sigues en modo prueba y los cobros llegan a la cuenta del proyecto.',

  bankFailed: (reason) => `No pudimos registrar tu CLABE. ${reason}`,

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

  sendFailed: (charge, reason, { suggestLink = false } = {}) =>
    [
      `No se pudo enviar el cobro de ${describe(charge)}. ${reason}`,
      suggestLink
        ? `\nSi tu cliente no tiene CoDi activo, mándale una liga de pago, que también acepta tarjeta: *${linkCommand(charge)}*`
        : null,
    ]
      .filter(Boolean)
      .join('\n'),

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
    charge.kind === 'qr'
      ? `⏰ El QR de ${amountAndConcept(charge)} expiró sin pagarse. Si tu cliente todavía quiere pagar, pide uno nuevo.`
      : [
      `⏰ El cobro de ${describe(charge)} expiró sin pagarse.`,
      '',
      canLink
        ? 'Si tu cliente no tiene CoDi activo, no le llegó la solicitud. Responde *liga* y te mando una liga de pago para que se la reenvíes; también acepta tarjeta. O vuelve a escribir el cobro para intentarlo otra vez.'
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

  directLink: (charge) =>
    [
      `Esta es tu liga para cobrar ${amountAndConcept(charge)}. Mándasela a tu cliente por WhatsApp, correo o donde quieras:`,
      '',
      charge.linkUrl,
      '',
      'Puede pagar con CoDi o con tarjeta. Te aviso en cuanto pague.',
    ].join('\n'),

  qrCaption: (charge, minutes) =>
    [
      `QR para cobrar ${amountAndConcept(charge)}.`,
      `Tu cliente lo escanea con la app de su banco. Vence en ${minutes} minutos y te aviso en cuanto pague.`,
    ].join('\n'),

  qrFailed: (charge, reason) => `No pude generar el QR de ${amountAndConcept(charge)}. ${reason}`,

  directLinkFailed: (charge, reason) => `No pude generar la liga de ${amountAndConcept(charge)}. ${reason}`,

  demoAmountLimit: (maxCents) =>
    `En modo prueba el monto máximo es de ${money(maxCents)} por cobro. Los cobros son reales, así que prueba con $0.01. Para cobrar más, registra tu propia CLABE.`,

  demoTooMany: () =>
    'Llegaste al límite de cobros por hora del modo prueba. Espera una hora para probar de nuevo.',

  payerTooMany: (payerPhone) =>
    `Ya se mandaron varios cobros al ${phone(payerPhone)} en la última hora. Para no molestar a esa persona, espera un rato antes de volver a intentarlo.`,

  linkFailed: (charge) => `No pude generar la liga para el cobro de ${describe(charge)}. Intenta de nuevo en un momento.`,

  summary: ({ paid, pending, expiredCount, bySeller = null }) => {
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
    if (bySeller) {
      lines.push('', '*Por persona*');
      for (const seller of bySeller) {
        const pendingText = seller.pendingCount ? `, ${seller.pendingCount} pendiente${seller.pendingCount === 1 ? '' : 's'}` : '';
        lines.push(`• ${seller.name}: ${money(seller.paidCents)} en ${plural(seller.paidCount, 'cobro', 'cobros')}${pendingText}`);
      }
    }
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
