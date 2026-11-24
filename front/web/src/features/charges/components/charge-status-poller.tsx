'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const POLL_MS = 4_000;

/**
 * Mientras el cobro espera el pago, vuelve a pedir la página al servidor cada
 * 4 s; así aparece "Pagado" en cuanto llega el webhook de pey a la API.
 */
export function ChargeStatusPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
