import { describe, expect, it } from 'vitest';
import { parseNewChargeForm, tipPreview } from './new-charge-form.policy';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe('parseNewChargeForm', () => {
  it('push: celular, monto y concepto', () => {
    expect(
      parseNewChargeForm(form({ method: 'push', phone: '55 1234-5678', amount: '$1,500.5', concept: ' corte ' })),
    ).toEqual({
      ok: true,
      data: { method: 'push', phone: '5512345678', amount: 1500.5, concept: 'corte' },
    });
  });

  it('acepta el celular con lada de país +52', () => {
    const result = parseNewChargeForm(form({ method: 'push', phone: '+52 55 1234 5678', amount: '10' }));
    expect(result).toMatchObject({ ok: true, data: { phone: '5512345678' } });
  });

  it('QR y liga no piden celular y el concepto es opcional', () => {
    expect(parseNewChargeForm(form({ method: 'qr', phone: '', amount: '80' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 80 },
    });
    expect(parseNewChargeForm(form({ method: 'link', amount: '0.01' }))).toMatchObject({
      ok: true,
      data: { method: 'link', amount: 0.01 },
    });
  });

  it('valida celular, monto y concepto como la API', () => {
    expect(
      parseNewChargeForm(form({ method: 'push', phone: '12345', amount: '1.234', concept: 'x'.repeat(41) })),
    ).toEqual({
      ok: false,
      fieldErrors: {
        phone: 'El celular debe tener 10 dígitos',
        amount: 'Escribe el monto en pesos, con máximo 2 decimales',
        concept: 'El concepto admite máximo 40 caracteres',
      },
    });
    expect(parseNewChargeForm(form({ method: 'qr', amount: '0' }))).toMatchObject({
      fieldErrors: { amount: 'El monto debe ser mayor a 0' },
    });
    expect(parseNewChargeForm(form({ method: 'qr', amount: '1000000.01' }))).toMatchObject({
      fieldErrors: { amount: 'El monto máximo por cobro es de $1,000,000' },
    });
  });

  it('un método desconocido se trata como push', () => {
    expect(parseNewChargeForm(form({ method: 'otro', phone: '5512345678', amount: '1' }))).toMatchObject({
      ok: true,
      data: { method: 'push' },
    });
  });
});

describe('propina en parseNewChargeForm', () => {
  const base = { method: 'qr', amount: '100' };

  it('sin propina (por defecto) no manda tip', () => {
    expect(parseNewChargeForm(form(base))).toEqual({ ok: true, data: { method: 'qr', amount: 100 } });
    expect(parseNewChargeForm(form({ ...base, tipOption: 'none' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 100 },
    });
  });

  it('porcentaje sobre el cobro, redondeado a centavos', () => {
    expect(parseNewChargeForm(form({ ...base, tipOption: '15' }))).toMatchObject({ data: { amount: 100, tip: 15 } });
    expect(parseNewChargeForm(form({ ...base, amount: '33.33', tipOption: '15' }))).toMatchObject({
      data: { amount: 33.33, tip: 5 },
    });
    expect(parseNewChargeForm(form({ ...base, amount: '0.05', tipOption: '10' }))).toMatchObject({
      data: { tip: 0.01 },
    });
    expect(parseNewChargeForm(form({ ...base, amount: '0.04', tipOption: '10' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 0.04 },
    });
  });

  it('otra: usa el texto escrito', () => {
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '$7.5' }))).toMatchObject({
      data: { tip: 7.5 },
    });
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '' }))).toMatchObject({
      fieldErrors: { tip: 'Escribe la propina en pesos, con máximo 2 decimales' },
    });
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: 'abc' }))).toMatchObject({
      fieldErrors: { tip: 'Escribe la propina en pesos, con máximo 2 decimales' },
    });
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '1.234' }))).toMatchObject({
      fieldErrors: { tip: 'La propina admite máximo 2 decimales' },
    });
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '-5' }))).toMatchObject({
      fieldErrors: { tip: 'La propina no puede ser negativa' },
    });
  });

  it('otra con 0 equivale a sin propina', () => {
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '0' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 100 },
    });
  });

  it('la propina no puede ser mayor que el cobro ni el total pasar de 1,000,000', () => {
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '100.01' }))).toMatchObject({
      fieldErrors: { tip: 'La propina no puede ser mayor que el cobro' },
    });
    expect(parseNewChargeForm(form({ ...base, tipOption: 'custom', tip: '100' }))).toMatchObject({
      data: { tip: 100 },
    });
    expect(
      parseNewChargeForm(form({ ...base, amount: '999999', tipOption: 'custom', tip: '2' })),
    ).toMatchObject({ fieldErrors: { tip: 'El total con propina no puede pasar de $1,000,000' } });
  });
});

describe('tipPreview', () => {
  it('calcula cobro, propina y total', () => {
    expect(tipPreview('100', '15', '')).toEqual({ subtotal: 100, tip: 15, total: 115 });
    expect(tipPreview('100', 'none', '')).toEqual({ subtotal: 100, tip: 0, total: 100 });
    expect(tipPreview('$1,000.50', 'custom', '20')).toEqual({ subtotal: 1000.5, tip: 20, total: 1020.5 });
  });

  it('redondea a centavos', () => {
    expect(tipPreview('0.05', '10', '')).toEqual({ subtotal: 0.05, tip: 0.01, total: 0.06 });
    expect(tipPreview('33.33', '15', '')).toEqual({ subtotal: 33.33, tip: 5, total: 38.33 });
  });

  it('null si el monto no es válido; propina personalizada inválida cuenta como 0', () => {
    expect(tipPreview('', '15', '')).toBeNull();
    expect(tipPreview('abc', 'none', '')).toBeNull();
    expect(tipPreview('0', 'none', '')).toBeNull();
    expect(tipPreview('100', 'custom', 'xx')).toEqual({ subtotal: 100, tip: 0, total: 100 });
  });
});
