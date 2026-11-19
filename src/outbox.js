// A dónde van las respuestas del bot.
//
// Un mismo bot atiende a dos tipos de comerciante:
//  - por WhatsApp: `to` es su número, y se responde con la Cloud API;
//  - en la demo web: `to` es "demo:<sesión>", y la respuesta se guarda en la
//    conversación de esa sesión, que la página va leyendo.

export function createOutbox({ db, whatsapp = null, log = console }) {
  const demoSession = (to) => (String(to).startsWith('demo:') ? String(to).slice('demo:'.length) : null);

  function whatsappOrLog() {
    return (
      whatsapp ?? {
        async sendText(to, body) {
          log.info(`[sin WhatsApp] para ${to}:\n${body}`);
        },
        async sendImage(to, { caption }) {
          log.info(`[sin WhatsApp] imagen para ${to}: ${caption ?? ''}`);
        },
      }
    );
  }

  return {
    async sendText(to, body) {
      const session = demoSession(to);
      if (session) return db.addDemoMessage(session, 'bot', { body });
      return whatsappOrLog().sendText(to, body);
    },

    async sendImage(to, { png, caption }) {
      const session = demoSession(to);
      if (session) return db.addDemoMessage(session, 'bot', { body: caption ?? null, imagePng: png.toString('base64') });
      return whatsappOrLog().sendImage(to, { png, caption });
    },
  };
}
