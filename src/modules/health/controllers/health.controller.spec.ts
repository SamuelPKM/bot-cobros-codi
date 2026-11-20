import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde ok cuando Postgres contesta', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource;
    await expect(new HealthController(dataSource).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('responde 503 cuando Postgres no contesta', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as DataSource;
    const promise = new HealthController(dataSource).check();
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promise).rejects.toMatchObject({
      response: { status: 'error', database: 'down' },
    });
  });
});
