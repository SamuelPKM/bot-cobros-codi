import { aSummary } from '../../../../test/fixtures';
import { getTodaySummary } from './reports.api';

describe('getTodaySummary', () => {
  it('pide el resumen de hoy', async () => {
    const request = jest.fn().mockResolvedValue(aSummary());
    await expect(getTodaySummary(request)).resolves.toEqual(aSummary());
    expect(request).toHaveBeenCalledWith('/reports/today');
  });
});
