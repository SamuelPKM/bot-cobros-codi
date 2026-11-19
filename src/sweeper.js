// Agenda el barrido de cobros sin consultar la base de más.
//
// El barrido expira cobros vencidos, reintenta avisos y revisa CLABEs. Correrlo
// cada 30 segundos para siempre impediría que una base serverless (como Neon,
// que duerme tras 5 minutos sin consultas) se suspenda, y gastaría su cupo de
// cómputo. Por eso, después de cada barrido se calcula cuándo hace falta el
// siguiente: al vencer el próximo cobro, pronto si hay avisos por reintentar,
// o en `idleMs` si no hay nada pendiente.

export const EXPIRATION_GRACE_MS = 20 * 1000; // igual que en charges.js
const BANK_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Milisegundos hasta el siguiente barrido, según lo que dejó pendiente el anterior. */
export function nextSweepDelay({ now, nextDueAt, hasUnnotified, oldestBankCheckAt }, { minMs = 30_000, idleMs = 30 * 60_000 } = {}) {
  if (hasUnnotified) return minMs;
  const candidates = [idleMs];
  if (nextDueAt != null) candidates.push(nextDueAt + EXPIRATION_GRACE_MS - now);
  if (oldestBankCheckAt != null) candidates.push(oldestBankCheckAt + BANK_CHECK_INTERVAL_MS - now);
  return Math.min(idleMs, Math.max(minMs, Math.min(...candidates)));
}

/**
 * @param sweep la función que barre (charges.sweep).
 * @param hints la función que dice qué quedó pendiente (store.sweepHints).
 */
export function createSweeper({ sweep, hints, now = Date.now, minMs = 30_000, idleMs = 30 * 60_000, log = console }) {
  let timer = null;
  let dueAt = Infinity;
  let running = false;
  let stopped = false;

  function schedule(delay) {
    if (stopped) return;
    const at = now() + delay;
    if (timer && at >= dueAt) return; // ya hay uno antes
    clearTimeout(timer);
    dueAt = at;
    timer = setTimeout(run, delay);
    timer.unref?.();
  }

  async function run() {
    timer = null;
    dueAt = Infinity;
    if (running) return schedule(minMs);
    running = true;
    let delay = minMs;
    try {
      await sweep();
      delay = nextSweepDelay({ now: now(), ...(await hints()) }, { minMs, idleMs });
    } catch (error) {
      log.error(`[barrido] ${error.message}`);
    } finally {
      running = false;
    }
    schedule(delay);
  }

  return {
    /** Primer barrido al arrancar. */
    start: () => schedule(0),
    /** Algo nuevo puede vencer pronto (un push enviado, un QR): barrer en `minMs`. */
    poke: () => schedule(minMs),
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
