import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { PEY_FETCH } from './constants/pey.constants';
import { PeyClient } from './services/pey-client.service';

/**
 * Adaptador de la API de pey. Expone solo PeyClient: los demás módulos
 * (cobros, webhooks) hablan con pey a través de él.
 */
@Module({
  providers: [
    { provide: PEY_FETCH, useValue: globalThis.fetch },
    {
      provide: PeyClient,
      inject: [ConfigService, PEY_FETCH],
      useFactory: (
        config: ConfigService<Env, true>,
        fetch: typeof globalThis.fetch,
      ) =>
        new PeyClient({
          apiKey: config.get('PEY_API_KEY', { infer: true }),
          baseUrl: config.get('PEY_BASE_URL', { infer: true }),
          fetch,
        }),
    },
  ],
  exports: [PeyClient],
})
export class PeyModule {}
