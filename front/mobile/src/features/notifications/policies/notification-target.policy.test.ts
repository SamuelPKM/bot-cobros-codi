import { chargeIdFromNotification } from './notification-target.policy';

describe('chargeIdFromNotification', () => {
  it('el cobro del aviso "Pago recibido"', () => {
    expect(chargeIdFromNotification({ type: 'charge.paid', chargeId: 42 })).toBe(42);
  });

  it('ignora avisos de otro tipo o con datos raros', () => {
    expect(chargeIdFromNotification({ type: 'otro', chargeId: 42 })).toBeNull();
    expect(chargeIdFromNotification({ type: 'charge.paid', chargeId: '42/../x' })).toBeNull();
    expect(chargeIdFromNotification({ type: 'charge.paid', chargeId: -1 })).toBeNull();
    expect(chargeIdFromNotification({ type: 'charge.paid', chargeId: 1.5 })).toBeNull();
    expect(chargeIdFromNotification(undefined)).toBeNull();
  });
});
