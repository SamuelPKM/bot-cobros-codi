import { parseNewChargeForm } from './new-charge-form.policy';

const form = (over: Partial<Parameters<typeof parseNewChargeForm>[0]>) => ({
  method: 'push' as const,
  phone: '',
  amount: '',
  concept: '',
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
