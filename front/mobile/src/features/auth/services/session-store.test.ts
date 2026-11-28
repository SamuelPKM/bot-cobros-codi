import * as SecureStore from 'expo-secure-store';
import { aUser } from '../../../../test/fixtures';
import { clearSession, loadSession, saveSession } from './session-store';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void items.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void items.delete(key)),
  };
});

describe('session-store', () => {
  beforeEach(async () => {
    await clearSession();
  });

  it('guarda y recupera la sesión, solo en este dispositivo', async () => {
    const session = { token: 'jwt-1', user: aUser() };
    await saveSession(session);
    await expect(loadSession()).resolves.toEqual(session);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it('sin sesión guardada devuelve null', async () => {
    await expect(loadSession()).resolves.toBeNull();
  });

  it('si lo guardado está dañado lo borra y devuelve null', async () => {
    await SecureStore.setItemAsync('cobrale.session', '{no es json');
    await expect(loadSession()).resolves.toBeNull();
    await SecureStore.setItemAsync('cobrale.session', JSON.stringify({ token: 1 }));
    await expect(loadSession()).resolves.toBeNull();
    expect(await SecureStore.getItemAsync('cobrale.session')).toBeNull();
  });

  it('clearSession la borra', async () => {
    await saveSession({ token: 'jwt-1', user: aUser() });
    await clearSession();
    await expect(loadSession()).resolves.toBeNull();
  });
});
