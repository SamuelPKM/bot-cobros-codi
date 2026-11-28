import { render, screen } from '@testing-library/react-native';
import { Logo } from './logo';

describe('Logo', () => {
  it('se anuncia como imagen "Cóbrale"', async () => {
    await render(<Logo />);
    expect(screen.getByRole('image', { name: 'Cóbrale' })).toBeOnTheScreen();
  });
});
