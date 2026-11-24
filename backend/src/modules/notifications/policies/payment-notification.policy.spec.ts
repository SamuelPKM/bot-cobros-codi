import { paymentNotification } from './payment-notification.policy';

describe('paymentNotification', () => {
  it('dice cuánto se cobró, quién lo cobró y el concepto', () => {
    expect(
      paymentNotification({
        chargeId: 7,
        amountCents: 15_050,
        sellerName: 'Ana',
        concept: 'Orden 12',
      }),
    ).toEqual({
      title: 'Pago recibido',
      body: '$150.50 · Ana · Orden 12',
      data: { chargeId: 7, type: 'charge.paid' },
    });
  });

  it('sin concepto solo muestra monto y vendedor, con separador de miles', () => {
    expect(
      paymentNotification({
        chargeId: 1,
        amountCents: 123_456_78,
        sellerName: 'Leo',
        concept: null,
      }).body,
    ).toBe('$123,456.78 · Leo');
  });
});
