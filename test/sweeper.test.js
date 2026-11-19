import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createSweeper, nextSweepDelay } from '../src/sweeper.js';
import { fakeClock, freshStore, silentLog } from './helpers.js';

const MIN = 30_000;
const IDLE = 30 * 60_000;
const HOUR = 60 * 60_000;

describe('nextSweepDelay', () => {
  const now = 1_000_000;
  const delay = (hints) => nextSweepDelay({ now, nextDueAt: null, hasUnnotified: false, oldestBankCheckAt: null, ...hints });

  it('sin nada pendiente espera el máximo, para que la base pueda dormir', () => {
    assert.equal(delay({}), IDLE);
  });

  it('con un cobro por vencer, barre justo después de su vencimiento', () => {
    assert.equal(delay({ nextDueAt: now + 6 * 60_000 }), 6 * 60_000 + 20_000);
  });

  it('nunca antes del mínimo ni después del máximo', () => {
    assert.equal(delay({ nextDueAt: now - 5000 }), MIN);
    assert.equal(delay({ nextDueAt: now + 5 * HOUR }), IDLE);
  });

  it('con avisos por reintentar, barre pronto', () => {
    assert.equal(delay({ hasUnnotified: true, nextDueAt: now + HOUR }), MIN);
  });

  it('una CLABE en validación se vuelve a revisar a la hora', () => {
    assert.equal(delay({ oldestBankCheckAt: now - 50 * 60_000 }), 10 * 60_000);
  });
});

describe('store.sweepHints', () => {
  it('reporta el vencimiento más próximo, avisos pendientes y CLABEs en validación', async () => {
    const now = fakeClock();
    const store = await freshStore({ now });
    assert.deepEqual(await store.sweepHints(), { nextDueAt: null, hasUnnotified: false, oldestBankCheckAt: null });

    const a = await store.createCharge({ channel: 'web', ownerKey: 'm:1', amountCents: 1, status: 'pending' });
    await store.updateCharge(a.id, { expiresAt: now() + 9000 });
    const b = await store.createCharge({ kind: 'qr', channel: 'web', ownerKey: 'm:1', amountCents: 1, status: 'qr' });
    await store.updateCharge(b.id, { expiresAt: now() + 5000 });
    await store.createCharge({ channel: 'whatsapp', ownerKey: 'm:1', notifyTo: '521', amountCents: 1, status: 'paid' });
    const m = await store.createMerchant({ businessName: 'Leo' });
    await store.updateMerchant(m.id, { bankAccountId: 'BA1', bankStatus: 'PENDING', bankCheckedAt: now() - 10 });

    assert.deepEqual(await store.sweepHints(), { nextDueAt: now() + 5000, hasUnnotified: true, oldestBankCheckAt: now() - 10 });
  });
});

describe('createSweeper', () => {
  it('barre al arrancar, se reagenda según lo pendiente y poke lo adelanta', async () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
      let sweeps = 0;
      let hints = { nextDueAt: null, hasUnnotified: false, oldestBankCheckAt: null };
      const sweeper = createSweeper({
        sweep: async () => {
          sweeps += 1;
        },
        hints: async () => hints,
        log: silentLog,
      });
      const flush = () => new Promise((resolve) => setImmediate(resolve));

      sweeper.start();
      mock.timers.tick(0);
      await flush();
      assert.equal(sweeps, 1);

      // Nada pendiente: el siguiente barrido es en 30 minutos.
      mock.timers.tick(IDLE - 1);
      await flush();
      assert.equal(sweeps, 1);

      // Llega un cobro nuevo: poke adelanta el barrido a 30 segundos.
      hints = { ...hints, nextDueAt: Date.now() + 6 * 60_000 };
      sweeper.poke();
      mock.timers.tick(MIN);
      await flush();
      assert.equal(sweeps, 2);

      sweeper.stop();
      mock.timers.tick(IDLE * 2);
      await flush();
      assert.equal(sweeps, 2);
    } finally {
      mock.timers.reset();
    }
  });
});
