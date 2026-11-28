import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, type ApiRequest } from '@/shared/api/api-client';
import { messageFor } from '@/shared/api/error-message';
import type { PublicCharge } from '../interfaces/public-charge.interface';
import { isWaitingPayment } from '../policies/charge-view.policy';
import { getCharge } from '../services/charges.api';

/** Cada cuánto se pregunta si ya se pagó. */
export const POLL_MS = 4000;

export interface LiveCharge {
  charge: PublicCharge | null;
  error: string | null;
  notFound: boolean;
  /** Pone el cobro que ya devolvió la API (p. ej. tras pedir el plan B). */
  replace(charge: PublicCharge): void;
}

/**
 * El cobro, al día: pregunta a la API cada 4 s mientras siga pendiente y de
 * inmediato al volver a la app (el cliente suele pagar mientras está en su banco).
 */
export function useLiveCharge(request: ApiRequest, id: number): LiveCharge {
  const [charge, setCharge] = useState<PublicCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const inFlight = useRef(false);
  const done = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current || done.current) return;
    inFlight.current = true;
    try {
      const next = await getCharge(request, id);
      setCharge(next);
      setError(null);
      if (!isWaitingPayment(next)) done.current = true;
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 404 || failure.status === 403)) {
        done.current = true;
        setNotFound(true);
      } else setError(messageFor(failure));
    } finally {
      inFlight.current = false;
    }
  }, [request, id]);

  useEffect(() => {
    done.current = false;
    // load() solo cambia el estado después de su await: no es un setState síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [load]);

  const replace = useCallback((next: PublicCharge) => {
    setCharge(next);
    done.current = !isWaitingPayment(next);
  }, []);

  return { charge, error, notFound, replace };
}
