import {
  addDays,
  byMethod,
  change,
  dailyPaid,
  paymentRate,
  periodRange,
} from './overview.policy';

describe('overview.policy', () => {
  it('suma y resta días, cruzando meses y años', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('arma el periodo y el anterior, del mismo largo y sin traslaparse', () => {
    expect(periodRange('2026-11-24', 7)).toEqual({
      from: '2026-11-18',
      to: '2026-11-24',
      previousFrom: '2026-11-11',
      previousTo: '2026-11-17',
    });
  });

  it('pone un día por elemento, en orden y con ceros, contando solo lo pagado', () => {
    const daily = dailyPaid('2026-11-22', 3, [
      { day: '2026-11-24', status: 'paid', count: '2', cents: '15050' },
      { day: '2026-11-22', status: 'paid', count: 1, cents: 1000 },
      { day: '2026-11-22', status: 'expired', count: 4, cents: 9999 },
    ]);
    expect(daily).toEqual([
      { date: '2026-11-22', count: 1, amount: 10 },
      { date: '2026-11-23', count: 0, amount: 0 },
      { date: '2026-11-24', count: 2, amount: 150.5 },
    ]);
  });

  it('la tasa de pago ignora los pendientes', () => {
    expect(
      paymentRate([
        { day: 'x', status: 'paid', count: 3, cents: 0 },
        { day: 'x', status: 'expired', count: 1, cents: 0 },
        { day: 'y', status: 'pending', count: 10, cents: 0 },
      ]),
    ).toBe(0.75);
    expect(
      paymentRate([{ day: 'x', status: 'pending', count: 2, cents: 0 }]),
    ).toBeNull();
  });

  it('da siempre los tres medios en orden, con ceros', () => {
    expect(byMethod([{ method: 'qr', count: '2', cents: '300' }])).toEqual([
      { method: 'push', count: 0, amount: 0 },
      { method: 'qr', count: 2, amount: 3 },
      { method: 'link', count: 0, amount: 0 },
    ]);
  });

  it('el cambio es null si antes no hubo nada', () => {
    expect(change(150, 100)).toBe(0.5);
    expect(change(50, 100)).toBe(-0.5);
    expect(change(10, 0)).toBeNull();
  });
});
