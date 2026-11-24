import { money } from '../../conversations/policies/conversation-texts';

// Textos propios de la demo pública. Los del cobro vienen del motor de conversación.
export const demoTexts = {
  welcome: (businessName: string, maxAmountCents: number) =>
    [
      `Hola, soy *Cóbrale*. En esta demo cobras como parte de *${businessName}* y yo te ayudo a cobrar con CoDi.`,
      '',
      'Prueba cualquiera de estas:',
      '• *cobra 0.01 a <tu celular> prueba*: te llega la solicitud de pago a la app de tu banco.',
      '• *qr 0.01 prueba*: te doy un QR para escanear.',
      '• *liga 0.01 prueba*: te doy una liga de pago.',
      '',
      `Los cobros son reales y el máximo es de ${money(maxAmountCents)}. En cuanto pagues te aviso aquí.`,
    ].join('\n'),
  tooManyCharges: (limit: number) =>
    `Llegaste al límite de ${limit} cobros por hora de la demo. Vuelve a intentarlo más tarde.`,
  somethingWrong: () =>
    'Algo salió mal de mi lado. Intenta de nuevo en un momento.',
};
