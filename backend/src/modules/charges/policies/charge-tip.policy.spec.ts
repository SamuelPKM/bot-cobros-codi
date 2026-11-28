import { splitTotal, tipViolation } from './charge-tip.policy';

describe('tipViolation', () => {
  it('acepta cobro sin propina y propina menor o igual al cobro', () => {
    expect(tipViolation(10_000, 0)).toBeNull();
    expect(tipViolation(11_500, 1_500)).toBeNull();
    expect(tipViolation(20_000, 10_000)).toBeNull();
  });

  it('rechaza una propina mayor que el cobro', () => {
    expect(tipViolation(11_000, 6_000)).toBe(
      'La propina no puede ser mayor que el cobro',
    );
  });

  it('rechaza un total de más de $1,000,000', () => {
    expect(tipViolation(100_000_200, 200)).toBe(
      'El total con propina no puede pasar de $1,000,000',
    );
    expect(tipViolation(100_000_000, 0)).toBeNull();
  });
});

describe('splitTotal', () => {
  it('separa el total en cobro sin propina y propina', () => {
    expect(splitTotal(11_500, 1_500)).toEqual({
      subtotalCents: 10_000,
      tipCents: 1_500,
    });
  });
});
