import { PeyError } from './pey.error';

describe('PeyError', () => {
  it.each(['TIMEOUT', 'NETWORK_ERROR'])(
    '%s significa que no se sabe si pey procesó la petición',
    (type) => {
      expect(new PeyError('x', { type }).isOutcomeUnknown).toBe(true);
    },
  );

  it.each(['INVALID_AMOUNT', 'INVALID_STATE', 'UNKNOWN'])(
    '%s es un rechazo seguro: pey no hizo nada',
    (type) => {
      expect(new PeyError('x', { type, status: 400 }).isOutcomeUnknown).toBe(
        false,
      );
    },
  );

  it('conserva la causa original', () => {
    const cause = new TypeError('fetch failed');
    expect(new PeyError('x', { type: 'NETWORK_ERROR', cause }).cause).toBe(
      cause,
    );
  });
});
