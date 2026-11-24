import { normalizePhone, parseMessage } from './command.parser';

describe('normalizePhone', () => {
  it.each([
    ['5512345678', '5512345678'],
    ['55 1234 5678', '5512345678'],
    ['(55) 1234-5678', '5512345678'],
    ['+52 55 1234 5678', '5512345678'],
    ['5215512345678', '5512345678'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['123', '551234567', '+1 555 123 4567'])('rechaza %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('parseMessage', () => {
  it('entiende el cobro con celular, monto con formato y concepto', () => {
    expect(
      parseMessage('Cobra $1,500.50 al +52 55 1234 5678 anticipo'),
    ).toEqual({
      type: 'charge',
      amountCents: 150_050,
      payerPhone: '5512345678',
      concept: 'anticipo',
    });
    expect(parseMessage('cobrar 80 pesos a 5512345678')).toEqual({
      type: 'charge',
      amountCents: 8000,
      payerPhone: '5512345678',
      concept: null,
    });
  });

  it('un concepto que empieza con número no se confunde con el teléfono', () => {
    expect(parseMessage('cobra 300 a 5512345678 2 cortes')).toMatchObject({
      payerPhone: '5512345678',
      concept: '2 cortes',
    });
  });

  it('explica qué está mal en un cobro', () => {
    expect(parseMessage('cobra 150 a 123')).toEqual({
      type: 'invalid',
      error: expect.stringMatching(/10 dígitos/),
    });
    expect(parseMessage('cobra mucho a 5512345678')).toMatchObject({
      type: 'invalid',
    });
    expect(parseMessage('cobra 1.234 a 5512345678')).toEqual({
      type: 'invalid',
      error: expect.stringMatching(/monto/),
    });
    expect(parseMessage('cobra 2000000 a 5512345678')).toEqual({
      type: 'invalid',
      error: expect.stringMatching(/1,000,000/),
    });
  });

  it('qr y liga sin teléfono', () => {
    expect(parseMessage('qr 150 corte de pelo')).toEqual({
      type: 'qr',
      amountCents: 15_000,
      concept: 'corte de pelo',
    });
    expect(parseMessage('liga de $80.50')).toEqual({
      type: 'link',
      amountCents: 8050,
      concept: null,
    });
    expect(parseMessage('qr')).toEqual({
      type: 'invalid',
      error: expect.stringMatching(/qr 150/),
    });
  });

  it('"liga" sola es el plan B del último cobro', () => {
    expect(parseMessage('Liga')).toEqual({ type: 'link-last' });
  });

  it.each([
    ['sí', 'confirm'],
    ['¡Sí!', 'confirm'],
    ['ok', 'confirm'],
    ['no', 'cancel'],
    ['Cancelar', 'cancel'],
    ['resumen', 'summary'],
    ['pendientes', 'summary'],
    ['hola', 'help'],
    ['ayuda', 'help'],
    ['qué tal', 'unknown'],
  ])('%s -> %s', (text, type) => {
    expect(parseMessage(text)).toEqual({ type });
  });

  it('vincular con un código de 6 dígitos', () => {
    expect(parseMessage('vincular 123456')).toEqual({
      type: 'link-account',
      code: '123456',
    });
    expect(parseMessage('Vincular 12 34 56')).toEqual({ type: 'unknown' });
  });
});
