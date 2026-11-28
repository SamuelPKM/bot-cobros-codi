import { parseNewChargeForm, tipPreview } from './new-charge-form.policy';

const form = (over: Partial<Parameters<typeof parseNewChargeForm>[0]>) => ({
  method: 'push' as const,
  phone: '',
  amount: '',
  concept: '',
  tipOption: 'none' as const,
  tip: '',
  ...over,
});

describe('parseNewChargeForm', () => {
  it('push: celular, monto y concepto', () => {
    expect(
      parseNewChargeForm(form({ phone: '55 1234-5678', amount: '$1,500.5', concept: ' corte ' })),
    ).toEqual({
      ok: true,
      data: { method: 'push', phone: '5512345678', amount: 1500.5, concept: 'corte' },
    });
  });

  it('acepta el celular con lada de país +52', () => {
    expect(parseNewChargeForm(form({ phone: '+52 55 1234 5678', amount: '10' }))).toMatchObject({
      ok: true,
      data: { phone: '5512345678' },
    });
  });

  it('QR y liga no piden celular y el concepto es opcional', () => {
    expect(parseNewChargeForm(form({ method: 'qr', phone: '55', amount: '80' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 80 },
    });
    expect(parseNewChargeForm(form({ method: 'link', amount: '0.01' }))).toEqual({
      ok: true,
      data: { method: 'link', amount: 0.01 },
    });
  });

  it('valida celular, monto y concepto como la API', () => {
    expect(
      parseNewChargeForm(form({ phone: '12345', amount: '1.234', concept: 'x'.repeat(41) })),
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

  it('acepta coma decimal, como la escribe el teclado en español', () => {
    expect(parseNewChargeForm(form({ method: 'qr', amount: '12,5' }))).toMatchObject({
      ok: true,
      data: { amount: 12.5 },
    });
  });
});

describe('propina en parseNewChargeForm', () => {
  it('sin propina no manda tip', () => {
    expect(parseNewChargeForm(form({ method: 'qr', amount: '100' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 100 },
    });
  });

  it('porcentaje sobre el cobro, redondeado a centavos', () => {
    expect(parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: '15' }))).toEqual({
      ok: true,
      data: { method: 'qr', amount: 100, tip: 15 },
    });
    expect(parseNewChargeForm(form({ method: 'qr', amount: '33.33', tipOption: '15' }))).toMatchObject({
      data: { tip: 5 },
    });
  });

  it('otra: acepta coma decimal', () => {
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: '12,5' })),
    ).toMatchObject({ ok: true, data: { amount: 100, tip: 12.5 } });
  });

  it('otra con 0 no manda tip', () => {
    const result = parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: '0' }));
    expect(result).toEqual({ ok: true, data: { method: 'qr', amount: 100 } });
  });

  it('otra inválida o negativa', () => {
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: 'abc' })),
    ).toEqual({
      ok: false,
      fieldErrors: { tip: 'Escribe la propina en pesos, con máximo 2 decimales' },
    });
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: '1.234' })),
    ).toMatchObject({ ok: false, fieldErrors: { tip: 'Escribe la propina en pesos, con máximo 2 decimales' } });
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: '-5' })),
    ).toMatchObject({ ok: false, fieldErrors: { tip: 'La propina no puede ser negativa' } });
  });

  it('la propina no puede ser mayor que el cobro', () => {
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: '100.01' })),
    ).toMatchObject({ ok: false, fieldErrors: { tip: 'La propina no puede ser mayor que el cobro' } });
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '100', tipOption: 'custom', tip: '100' })),
    ).toMatchObject({ ok: true });
  });

  it('el total con propina no pasa de $1,000,000', () => {
    expect(
      parseNewChargeForm(form({ method: 'qr', amount: '1000000', tipOption: '10' })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { tip: 'El total con propina no puede pasar de $1,000,000' },
    });
  });

  it('sin monto válido no valida la propina', () => {
    expect(parseNewChargeForm(form({ method: 'qr', amount: '', tipOption: '10' }))).toEqual({
      ok: false,
      fieldErrors: { amount: 'Escribe el monto en pesos, con máximo 2 decimales' },
    });
  });
});

describe('tipPreview', () => {
  it('calcula subtotal, propina y total', () => {
    expect(tipPreview(form({ amount: '100', tipOption: '15' }))).toEqual({ subtotal: 100, tip: 15, total: 115 });
  });
  it('redondea a centavos', () => {
    expect(tipPreview(form({ amount: '0.05', tipOption: '10' }))).toEqual({ subtotal: 0.05, tip: 0.01, total: 0.06 });
    expect(tipPreview(form({ amount: '33.33', tipOption: '15' }))).toEqual({ subtotal: 33.33, tip: 5, total: 38.33 });
  });
  it('sin propina o propina inválida cuenta 0', () => {
    expect(tipPreview(form({ amount: '80' }))).toEqual({ subtotal: 80, tip: 0, total: 80 });
    expect(tipPreview(form({ amount: '80', tipOption: 'custom', tip: 'x' }))).toEqual({ subtotal: 80, tip: 0, total: 80 });
  });
  it('null si el monto no es válido', () => {
    expect(tipPreview(form({ amount: '' }))).toBeNull();
    expect(tipPreview(form({ amount: '0' }))).toBeNull();
    expect(tipPreview(form({ amount: 'abc', tipOption: '10' }))).toBeNull();
  });
});
