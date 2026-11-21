import { unlinkWhatsApp } from '../actions/whatsapp-link.action';
import type { WhatsAppLink } from '../interfaces/whatsapp.interface';
import { LinkCodeButton } from './link-code-button';

/** Cobrar desde WhatsApp: cada persona liga su propio número. */
export function WhatsAppSettings({ link }: { link: WhatsAppLink }) {
  return (
    <section aria-labelledby="whatsapp-title" className="flex flex-col gap-3">
      <h2 id="whatsapp-title" className="text-lg font-semibold text-zinc-900">
        WhatsApp
      </h2>
      {link.linked ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-800">
          <span>
            Ligado al <span className="font-medium">{link.phone}</span>: ya puedes cobrar escribiendo
            «cobra 150 a 5512345678 corte».
          </span>
          <form action={unlinkWhatsApp}>
            <button type="submit" className="font-medium text-red-700 underline">
              Desligar
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-zinc-700">
          Liga tu número para cobrar y recibir el «✅ Pagado» por WhatsApp.
        </p>
      )}
      <LinkCodeButton linked={link.linked} />
    </section>
  );
}
