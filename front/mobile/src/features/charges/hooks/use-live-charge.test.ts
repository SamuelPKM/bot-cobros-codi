import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { aCharge } from '../../../../test/fixtures';
import { ApiError } from '@/shared/api/api-client';
import { POLL_MS, useLiveCharge } from './use-live-charge';

describe('useLiveCharge', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const flush = () => act(async () => {});

  it('carga el cobro y vuelve a preguntar mientras siga pendiente', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ charge: aCharge() })
      .mockResolvedValueOnce({ charge: aCharge() })
      .mockResolvedValue({ charge: aCharge({ status: 'paid', paidVia: 'push' }) });
    const { result } = await renderHook(() => useLiveCharge(request, 7));
    await flush();
    expect(result.current.charge?.status).toBe('pending');

    await act(async () => jest.advanceTimersByTime(POLL_MS));
    await act(async () => jest.advanceTimersByTime(POLL_MS));
    expect(result.current.charge?.status).toBe('paid');

    await act(async () => jest.advanceTimersByTime(POLL_MS * 3));
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenCalledWith('/charges/7');
  });

  it('al volver a la app pregunta de inmediato (el cliente pagó en su banco)', async () => {
    const request = jest.fn().mockResolvedValue({ charge: aCharge() });
    await renderHook(() => useLiveCharge(request, 7));
    await flush();

    await act(async () => appStateListener?.('active'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('si la consulta falla conserva lo último y sigue intentando', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ charge: aCharge() })
      .mockRejectedValueOnce(new ApiError(503, 'No pudimos conectar con el servidor.'))
      .mockResolvedValue({ charge: aCharge({ status: 'paid' }) });
    const { result } = await renderHook(() => useLiveCharge(request, 7));
    await flush();

    await act(async () => jest.advanceTimersByTime(POLL_MS));
    expect(result.current.charge?.status).toBe('pending');
    expect(result.current.error).toBe('No pudimos conectar con el servidor.');

    await act(async () => jest.advanceTimersByTime(POLL_MS));
    expect(result.current.charge?.status).toBe('paid');
    expect(result.current.error).toBeNull();
  });

  it('un cobro que no existe o no es tuyo queda como no encontrado', async () => {
    const request = jest.fn().mockRejectedValue(new ApiError(404, 'Cobro no encontrado'));
    const { result } = await renderHook(() => useLiveCharge(request, 99));
    await flush();
    expect(result.current.notFound).toBe(true);
    await act(async () => jest.advanceTimersByTime(POLL_MS * 2));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('replace pone el cobro que devolvió el plan B sin esperar', async () => {
    const request = jest.fn().mockResolvedValue({ charge: aCharge() });
    const { result } = await renderHook(() => useLiveCharge(request, 7));
    await flush();
    await act(async () => result.current.replace(aCharge({ concept: 'con QR' })));
    expect(result.current.charge?.concept).toBe('con QR');
  });
});
