import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PEY_FETCH } from './constants/pey.constants';
import { PeyModule } from './pey.module';
import { PeyClientFactory } from './services/pey-client.factory';

describe('PeyModule', () => {
  it('la fábrica arma un cliente con la API key de cada negocio y PEY_BASE_URL', async () => {
    const fetch = jest.fn(() =>
      Promise.resolve(new Response('{"id":"T","status":"PAID"}')),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        // Igual que en AppModule: la configuración es global.
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ PEY_BASE_URL: 'https://pey.test' })],
        }),
        PeyModule,
      ],
    })
      .overrideProvider(PEY_FETCH)
      .useValue(fetch)
      .compile();

    const factory = moduleRef.get(PeyClientFactory);
    await factory.create('llave-de-ana').getTransaction('T');
    await factory.create('llave-de-leo').getTransaction('T');

    const auth = (fetch.mock.calls as unknown as [string, RequestInit][]).map(
      ([url, init]) => [
        url,
        (init.headers as Record<string, string>).Authorization,
      ],
    );
    expect(auth).toEqual([
      ['https://pey.test/transaction/T', 'Bearer llave-de-ana'],
      ['https://pey.test/transaction/T', 'Bearer llave-de-leo'],
    ]);
  });
});
