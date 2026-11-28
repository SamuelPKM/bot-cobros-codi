import { render, screen } from '@testing-library/react-native';
import { aSummary } from '../../../../test/fixtures';
import { TodaySummary } from './today-summary';

describe('TodaySummary', () => {
  it('lo cobrado, lo pendiente y lo vencido de hoy', async () => {
    await render(<TodaySummary summary={aSummary()} />);
    expect(screen.getByText('Hoy')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cobrado hoy: $450.00, 3 cobros')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pendiente: $80.00, 1 cobro')).toBeOnTheScreen();
    expect(screen.getByLabelText('Vencidos: 2')).toBeOnTheScreen();
  });

  it('el admin ve el desglose por persona y quién cobró más', async () => {
    await render(
      <TodaySummary
        summary={aSummary({
          byPerson: [
            { userId: 1, name: 'Leo', role: 'seller', paidCount: 2, paidAmount: 300, pendingCount: 1 },
            { userId: 2, name: 'Mia', role: 'seller', paidCount: 1, paidAmount: 150, pendingCount: 0 },
          ],
        })}
      />,
    );
    expect(screen.getByText('Leo')).toBeOnTheScreen();
    expect(screen.getByText('$300.00 · 2 pagados · 1 pendiente')).toBeOnTheScreen();
    expect(screen.getByText('Mia')).toBeOnTheScreen();
    expect(screen.getAllByText('Más cobró hoy')).toHaveLength(1);
  });
});
