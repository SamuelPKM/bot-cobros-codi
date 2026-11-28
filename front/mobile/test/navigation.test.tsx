import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { aCharge, aSummary, aToken, aUser } from './fixtures';
import { loadSession } from '@/features/auth/services/session-store';

const mockRequest = jest.fn();

jest.mock('@/shared/api/app-api', () => ({
  createAppApi: () => ({ ok: true, request: mockRequest }),
}));
jest.mock('@/features/auth/services/session-store', () => ({
  loadSession: jest.fn(),
  saveSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/notifications/services/push-registration', () => ({
  registerForPush: jest.fn().mockResolvedValue(null),
  unregisterPush: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => null,
  clearLastNotificationResponse: jest.fn(),
}));

/** La API ficticia: responde según la ruta. */
function apiResponds() {
  mockRequest.mockImplementation(async (path: string) => {
    if (path === '/auth/login') return { tokenType: 'Bearer', accessToken: aToken(), user: aUser() };
    if (path === '/reports/today') return aSummary();
    if (path === '/reports/overview?days=7') return { businessName: 'Tacos La Esquina', logoVersion: null };
    if (path.startsWith('/charges?')) return { charges: [aCharge()] };
    if (path === '/charges/7') return { charge: aCharge() };
    throw new Error(`sin respuesta para ${path}`);
  });
}

const routes = './src/app';

describe('navegación', () => {
  beforeEach(apiResponds);

  it('sin sesión manda a Entrar aunque pidan el panel', async () => {
    jest.mocked(loadSession).mockResolvedValue(null);
    const router = await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/entrar');
  });

  it('al entrar llega al panel con el resumen y los cobros', async () => {
    jest.mocked(loadSession).mockResolvedValue(null);
    const user = userEvent.setup();
    const router = await renderRouter(routes, { initialUrl: '/' });

    await user.type(await screen.findByLabelText('Usuario'), 'ana');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/^Buen(os días|as tardes|as noches), Ana · /)).toBeOnTheScreen();
    expect(await screen.findByText('Tacos La Esquina')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
    expect(await screen.findByLabelText('Cobrado hoy: $450.00, 3 cobros')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /\$150\.00/ })).toBeOnTheScreen();
  });

  it('con sesión, el enlace a un cobro abre su detalle', async () => {
    jest.mocked(loadSession).mockResolvedValue({ token: aToken(), user: aUser() });
    const router = await renderRouter(routes, { initialUrl: '/cobros/7' });
    await waitFor(() => expect(router.getPathname()).toBe('/cobros/7'));
    expect(await screen.findByLabelText('Estado: Pendiente')).toBeOnTheScreen();
  });
});
