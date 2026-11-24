import { describe, expect, it } from 'vitest';
import { parseBusinessSettings } from './business-settings.policy';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe('parseBusinessSettings', () => {
  it('cada sección manda solo su campo', () => {
    expect(parseBusinessSettings(form({ section: 'name', name: ' Tacos Ana ' }))).toEqual({
      ok: true,
      data: { name: 'Tacos Ana' },
    });
    expect(parseBusinessSettings(form({ section: 'apiKey', peyApiKey: ' pey_nueva_123 ' }))).toEqual({
      ok: true,
      data: { peyApiKey: 'pey_nueva_123' },
    });
    expect(
      parseBusinessSettings(form({ section: 'webhook', peyWebhookSecret: 'whsec_abcdefgh123' })),
    ).toEqual({ ok: true, data: { peyWebhookSecret: 'whsec_abcdefgh123' } });
  });

  it('valida como la API', () => {
    expect(parseBusinessSettings(form({ section: 'name', name: '' }))).toEqual({
      ok: false,
      fieldErrors: { name: 'El nombre del negocio debe tener de 1 a 30 caracteres' },
    });
    expect(parseBusinessSettings(form({ section: 'apiKey', peyApiKey: 'corta' }))).toEqual({
      ok: false,
      fieldErrors: { peyApiKey: 'Escribe la API key de pey de tu negocio' },
    });
    expect(parseBusinessSettings(form({ section: 'webhook', peyWebhookSecret: 'secreto' }))).toEqual({
      ok: false,
      fieldErrors: { peyWebhookSecret: 'El secreto del webhook de pey empieza con whsec_' },
    });
  });

  it('una sección desconocida no manda nada', () => {
    expect(parseBusinessSettings(form({ section: 'otra' }))).toEqual({ ok: false, fieldErrors: {} });
  });
});
