import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { aToken, aUser } from '../../../../test/fixtures';
import { ApiError } from '@/shared/api/api-client';
import { clearSession, loadSession, saveSession } from '../services/session-store';
import { SessionProvider, useSession, type Session } from './session-provider';

jest.mock('../services/session-store', () => ({
  loadSession: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

const mockedLoad = jest.mocked(loadSession);

let current: Session;
function Probe({ expose }: { expose: (session: Session) => void }) {
  const session = useSession();
  useEffect(() => {
    expose(session);
  });
  const { state } = session;
  return (
    <Text testID="state">
      {state.status}
      {state.status === 'signedIn' ? ` ${state.user.name}` : ''}
      {state.status === 'signedOut' && state.notice ? ` ${state.notice}` : ''}
    </Text>
  );
}

const setup = async (request = jest.fn(), onSignOut?: jest.Mock) => {
  await render(
    <SessionProvider api={{ request }} onSignOut={onSignOut}>
      <Probe expose={(session) => (current = session)} />
    </SessionProvider>,
  );
  return request;
};

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.mocked(saveSession).mockResolvedValue();
    jest.mocked(clearSession).mockResolvedValue();
  });

  it('sin sesión guardada queda fuera', async () => {
    mockedLoad.mockResolvedValue(null);
    await setup();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signedOut'));
  });

  it('retoma la sesión guardada si el token sigue vigente', async () => {
    mockedLoad.mockResolvedValue({ token: aToken(), user: aUser() });
    await setup();
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('signedIn Ana Prueba'),
    );
  });

  it('si el token guardado ya venció lo borra y pide entrar', async () => {
    mockedLoad.mockResolvedValue({ token: aToken(-10), user: aUser() });
    await setup();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signedOut'));
    expect(clearSession).toHaveBeenCalled();
  });

  it('signIn entra con la API y guarda la sesión', async () => {
    mockedLoad.mockResolvedValue(null);
    const token = aToken();
    const request = await setup(
      jest.fn().mockResolvedValue({ tokenType: 'Bearer', accessToken: token, user: aUser() }),
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('signedOut'));

    await act(() => current.signIn({ username: 'ana', password: 'secreta' }));

    expect(request).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { username: 'ana', password: 'secreta' },
    });
    expect(saveSession).toHaveBeenCalledWith({ token, user: aUser() });
    expect(screen.getByTestId('state')).toHaveTextContent('signedIn Ana Prueba');
  });

  it('authedRequest manda el token de la sesión', async () => {
    const token = aToken();
    mockedLoad.mockResolvedValue({ token, user: aUser() });
    const request = await setup(jest.fn().mockResolvedValue({ charges: [] }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^signedIn/));

    await expect(current.authedRequest('/charges')).resolves.toEqual({ charges: [] });
    expect(request).toHaveBeenCalledWith('/charges', { token });
  });

  it('si la API responde 401 cierra la sesión y lo avisa', async () => {
    mockedLoad.mockResolvedValue({ token: aToken(), user: aUser() });
    await setup(jest.fn().mockRejectedValue(new ApiError(401, 'No autorizado')));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^signedIn/));

    await act(() => expect(current.authedRequest('/charges')).rejects.toBeInstanceOf(ApiError));

    expect(clearSession).toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent(
      'signedOut Tu sesión terminó. Entra de nuevo.',
    );
  });

  it('signOut avisa antes con el token (para borrar el aviso push) y borra la sesión', async () => {
    const token = aToken();
    mockedLoad.mockResolvedValue({ token, user: aUser() });
    const onSignOut = jest.fn().mockRejectedValue(new Error('sin red'));
    await setup(jest.fn(), onSignOut);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^signedIn/));

    await act(() => current.signOut());

    expect(onSignOut).toHaveBeenCalledWith(token);
    expect(clearSession).toHaveBeenCalled();
    expect(screen.getByTestId('state')).toHaveTextContent('signedOut');
  });
});
