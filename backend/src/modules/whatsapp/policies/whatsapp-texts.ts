// Textos propios del canal de WhatsApp (ligar el número). Los del cobro viven
// en el motor de conversación (conversations/policies/conversation-texts.ts).

export const whatsappTexts = {
  notRegistered: (frontendUrl: string) =>
    [
      'Hola. Este número no está ligado a ninguna cuenta de Cóbrale.',
      '',
      `Crea la cuenta de tu negocio o entra a la tuya en ${frontendUrl}`,
      'En *Ajustes → WhatsApp* te damos un código; mándalo aquí así: *vincular 123456*',
    ].join('\n'),
  linked: (businessName: string, personName: string) =>
    `Listo: este número quedó ligado a *${businessName}* como ${personName}. Ya puedes cobrar desde aquí; escribe *ayuda* para ver cómo.`,
  invalidCode: () =>
    'Ese código no es válido o ya venció. Pide uno nuevo en *Ajustes → WhatsApp*; dura 10 minutos.',
  tooManyAttempts: () =>
    'Demasiados intentos con códigos equivocados. Espera 15 minutos y vuelve a intentarlo.',
};
