import { phoneFromWaId } from './wa-phone.policy';

describe('phoneFromWaId', () => {
  it('quita el 521 con que Meta entrega los celulares mexicanos', () => {
    expect(phoneFromWaId('5215511112222')).toBe('5511112222');
  });

  it('quita el 52 del formato nuevo', () => {
    expect(phoneFromWaId('525511112222')).toBe('5511112222');
  });

  it('un número de otro país no es un celular de México', () => {
    expect(phoneFromWaId('14155550100')).toBeNull();
    expect(phoneFromWaId('5511112222')).toBeNull();
    expect(phoneFromWaId('52abc')).toBeNull();
  });
});
