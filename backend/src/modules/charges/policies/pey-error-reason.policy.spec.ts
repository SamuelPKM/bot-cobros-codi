import { PeyError } from '../../pey/errors/pey.error';
import { peyErrorReason } from './pey-error-reason.policy';

const reason = (type: string) =>
  peyErrorReason(new PeyError('x', { type, status: 400 }));

describe('peyErrorReason', () => {
  it('explica que la cuenta que recibe aún no está activa', () => {
    expect(reason('INVALID_STATE')).toMatch(/cuenta.*no está activa/i);
  });

  it.each([
    'INVALID_PARAMETER',
    'INCOMPLETE_PARAMETERS',
    'BAD_REQUEST',
    'INVALID_REQUEST',
  ])('%s pide revisar teléfono y monto', (type) => {
    expect(reason(type)).toMatch(/teléfono y el monto/);
  });

  it('explica un mantenimiento', () => {
    expect(reason('SERVICE_UNAVAILABLE')).toMatch(/mantenimiento/);
  });

  it.each(['TIMEOUT', 'NETWORK_ERROR'])(
    '%s pide no repetir el cobro, porque pudo haber llegado',
    (type) => {
      expect(peyErrorReason(new PeyError('x', { type }))).toMatch(
        /no lo repitas/i,
      );
    },
  );

  it('cualquier otro error sugiere reintentar más tarde', () => {
    expect(reason('ALGO_NUEVO')).toBe('Intenta de nuevo en unos minutos.');
  });
});
