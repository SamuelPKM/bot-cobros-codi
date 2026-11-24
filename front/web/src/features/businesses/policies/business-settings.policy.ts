import { field, type Parsed } from '@/shared/forms/form-state.type';

export type BusinessSettingsField = 'name' | 'peyApiKey' | 'peyWebhookSecret';

/** Cuerpo de PATCH /businesses/me: solo el campo de la sección que se guardó. */
export type BusinessSettingsInput =
  | { name: string }
  | { peyApiKey: string }
  | { peyWebhookSecret: string };

/** Mismas reglas que UpdateBusinessDto de la API. */
export function parseBusinessSettings(
  form: FormData,
): Parsed<BusinessSettingsField, BusinessSettingsInput> {
  switch (field(form, 'section')) {
    case 'name': {
      const name = field(form, 'name');
      return name && name.length <= 30
        ? { ok: true, data: { name } }
        : {
            ok: false,
            fieldErrors: { name: 'El nombre del negocio debe tener de 1 a 30 caracteres' },
          };
    }
    case 'apiKey': {
      const peyApiKey = field(form, 'peyApiKey');
      return peyApiKey.length >= 8 && peyApiKey.length <= 300 && !/\s/.test(peyApiKey)
        ? { ok: true, data: { peyApiKey } }
        : { ok: false, fieldErrors: { peyApiKey: 'Escribe la API key de pey de tu negocio' } };
    }
    case 'webhook': {
      const peyWebhookSecret = field(form, 'peyWebhookSecret');
      return /^whsec_\S{8,200}$/.test(peyWebhookSecret)
        ? { ok: true, data: { peyWebhookSecret } }
        : {
            ok: false,
            fieldErrors: { peyWebhookSecret: 'El secreto del webhook de pey empieza con whsec_' },
          };
    }
    default:
      return { ok: false, fieldErrors: {} };
  }
}
