import type { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { Env } from '../../../config/env.validation';
import {
  SWEEP_INTERVAL_MS,
  SWEEP_INTERVAL_NAME,
} from '../constants/sweeper.constants';
import { SweeperScheduler } from './sweeper.scheduler';
import type { SweeperService } from './sweeper.service';

const config = (enabled: boolean) =>
  ({ get: () => enabled }) as unknown as ConfigService<Env, true>;

describe('SweeperScheduler', () => {
  let registry: SchedulerRegistry;
  let sweep: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    registry = new SchedulerRegistry();
    sweep = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const name of registry.getIntervals()) registry.deleteInterval(name);
    jest.useRealTimers();
  });

  const scheduler = (enabled: boolean) =>
    new SweeperScheduler(
      { sweep } as unknown as SweeperService,
      registry,
      config(enabled),
    );

  it('programa el barrido cada 30 segundos cuando está activado', async () => {
    scheduler(true).onApplicationBootstrap();
    expect(registry.getIntervals()).toEqual([SWEEP_INTERVAL_NAME]);

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(sweep).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it('no programa nada con SWEEPER_ENABLED=false', () => {
    scheduler(false).onApplicationBootstrap();
    expect(registry.getIntervals()).toEqual([]);
  });

  it('se salta un ciclo si el barrido anterior sigue corriendo', async () => {
    let finish!: () => void;
    sweep.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    scheduler(true).onApplicationBootstrap();

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS * 2);
    expect(sweep).toHaveBeenCalledTimes(1);

    finish();
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it('un barrido que falla no detiene los siguientes', async () => {
    sweep.mockRejectedValueOnce(new Error('falló'));
    scheduler(true).onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS * 2);
    expect(sweep).toHaveBeenCalledTimes(2);
  });
});
