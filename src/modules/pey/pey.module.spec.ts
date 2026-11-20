import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PEY_FETCH } from './constants/pey.constants';
import { PeyModule } from './pey.module';
import { PeyClient } from './services/pey-client.service';

describe('PeyModule', () => {
  it('arma PeyClient con PEY_API_KEY y PEY_BASE_URL de la configuración', async () => {
    const fetch = jest.fn(() =>
      Promise.resolve(new Response('{"id":"T","status":"PAID"}')),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        // Igual que en AppModule: la configuración es global.
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({ PEY_API_KEY: 'llave', PEY_BASE_URL: 'https://pey.test' }),
          ],
        }),
        PeyModule,
      ],
    })
      .overrideProvider(PEY_FETCH)
      .useValue(fetch)
      .compile();

    await moduleRef.get(PeyClient).getTransaction('T');

    expect(fetch).toHaveBeenCalledWith(
      'https://pey.test/transaction/T',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer llave' }),
      }),
    );
  });
});
