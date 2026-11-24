import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { PEY_FETCH } from './constants/pey.constants';
import { PeyClientFactory } from './services/pey-client.factory';

/**
 * Adaptador de la API de pey. No tiene credenciales propias: expone
 * PeyClientFactory, que arma un cliente con la API key de cada negocio.
 */
@Module({
  providers: [
    { provide: PEY_FETCH, useValue: globalThis.fetch },
    {
      provide: PeyClientFactory,
      inject: [ConfigService, PEY_FETCH],
      useFactory: (
        config: ConfigService<Env, true>,
        fetch: typeof globalThis.fetch,
      ) =>
        new PeyClientFactory(
          config.get('PEY_BASE_URL', { infer: true }),
          fetch,
        ),
    },
  ],
  exports: [PeyClientFactory],
})
export class PeyModule {}
