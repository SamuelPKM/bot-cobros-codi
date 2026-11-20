import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { Env } from '../../../config/env.validation';
import {
  SWEEP_INTERVAL_MS,
  SWEEP_INTERVAL_NAME,
} from '../constants/sweeper.constants';
import { SweeperService } from './sweeper.service';

/** Programa el barrido cada 30 s si SWEEPER_ENABLED no es "false". */
@Injectable()
export class SweeperScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SweeperScheduler.name);
  private running = false;

  constructor(
    private readonly sweeper: SweeperService,
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('SWEEPER_ENABLED', { infer: true })) return;
    const interval = setInterval(() => void this.tick(), SWEEP_INTERVAL_MS);
    this.registry.addInterval(SWEEP_INTERVAL_NAME, interval);
  }

  /** Si el barrido anterior sigue corriendo, este se salta. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sweeper.sweep();
    } catch (error) {
      this.logger.error(`barrido falló: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
