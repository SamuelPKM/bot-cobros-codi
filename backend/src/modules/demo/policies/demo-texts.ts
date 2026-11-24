import { money } from '../../conversations/policies/conversation-texts';

// Textos propios de la demo pública. Los del cobro vienen del motor de conversación.
export const demoTexts = {
  welcome: (businessName: string, maxAmountCents: number) =>
    [
      `Hola, soy *Cóbrale*. En esta demo cobras como parte de *${businessName}* y yo te ayudo a cobrar con CoDi.`,
      '',
      'Prueba cualquiera de estas:',
      '• *qr 0.01 prueba*: te doy un QR para escanear con la app de tu banco.',
      '• *liga 0.01 prueba*: te doy una liga de pago.',
      '',
      `Los cobros son reales y el máximo es de ${money(maxAmountCents)}. En cuanto pagues te aviso aquí.`,
      '',
      'El cobro directo al celular (push) no está en la demo pública, para que nadie mande cobros al celular de otra persona. Se prueba con una cuenta del negocio.',
    ].join('\n'),
  pushDisabled: () =>
    [
      'En la demo pública no se mandan cobros al celular: cualquiera podría mandarle uno a otra persona.',
      '',
      'Prueba *qr 0.01 prueba* o *liga 0.01 prueba*. El cobro al celular se prueba entrando con una cuenta del negocio.',
    ].join('\n'),
  tooManyCharges: (limit: number) =>
    `Llegaste al límite de ${limit} cobros por hora de la demo. Vuelve a intentarlo más tarde.`,
  somethingWrong: () =>
    'Algo salió mal de mi lado. Intenta de nuevo en un momento.',
};
