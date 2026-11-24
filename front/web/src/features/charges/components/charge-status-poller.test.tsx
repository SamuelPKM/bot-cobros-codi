import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { ChargeStatusPoller } = await import('./charge-status-poller');

describe('ChargeStatusPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('mientras espera el pago vuelve a consultar cada 4 segundos', () => {
    render(<ChargeStatusPoller active />);
    act(() => vi.advanceTimersByTime(8_100));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('cuando ya no está pendiente deja de consultar', () => {
    const { rerender } = render(<ChargeStatusPoller active />);
    act(() => vi.advanceTimersByTime(4_100));
    rerender(<ChargeStatusPoller active={false} />);
    act(() => vi.advanceTimersByTime(20_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
