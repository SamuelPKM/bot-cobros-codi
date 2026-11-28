import { fireEvent, render, screen } from '@testing-library/react-native';
import { Avatar, initials } from './avatar';

// El avatar se oculta a los lectores de pantalla a propósito.
const hidden = { includeHiddenElements: true };

describe('initials', () => {
  it('toma la primera letra de hasta dos palabras', () => {
    expect(initials('Tacos La Esquina')).toBe('TL');
    expect(initials('ana')).toBe('A');
    expect(initials('  Ana   María  López ')).toBe('AM');
  });

  it('acepta dígitos y no truena con texto vacío', () => {
    expect(initials('7 Mares')).toBe('7M');
    expect(initials('   ')).toBe('');
  });
});

describe('Avatar', () => {
  it('sin imagen muestra las iniciales', async () => {
    await render(<Avatar name="Tacos La Esquina" />);
    expect(screen.getByText('TL', hidden)).toBeOnTheScreen();
  });

  it('si la imagen falla vuelve a las iniciales', async () => {
    await render(<Avatar name="Tacos La Esquina" source={{ uri: 'https://x.test/logo.png' }} />);
    expect(screen.queryByText('TL', hidden)).toBeNull();
    await fireEvent(screen.getByTestId('avatar-image', hidden), 'error');
    expect(screen.getByText('TL', hidden)).toBeOnTheScreen();
  });
});
