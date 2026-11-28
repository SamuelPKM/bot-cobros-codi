import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerForPush, unregisterPush } from './push-registration';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } }, easConfig: null },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

const notifications = jest.mocked(Notifications);
const TOKEN = 'ExponentPushToken[abc123]';

describe('registerForPush', () => {
  beforeEach(() => {
    (Device as { isDevice: boolean }).isDevice = true;
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
  });

  it('con permiso registra el token de Expo en la API', async () => {
    const request = jest.fn().mockResolvedValue(null);
    await expect(registerForPush(request)).resolves.toBe(TOKEN);
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(request).toHaveBeenCalledWith('/push-tokens', { method: 'POST', body: { token: TOKEN } });
  });

  it('en Android crea el canal de pagos con prioridad alta', async () => {
    Platform.OS = 'android';
    await registerForPush(jest.fn());
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'pagos',
      expect.objectContaining({ name: 'Pagos recibidos', importance: 4 }),
    );
    Platform.OS = 'ios';
  });

  it('pide permiso si no lo tiene; si lo niegan no registra nada', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true } as never);
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const request = jest.fn();
    await expect(registerForPush(request)).resolves.toBeNull();
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('en un simulador no hay avisos push', async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    await expect(registerForPush(jest.fn())).resolves.toBeNull();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('sin projectId de EAS no lo intenta', async () => {
    const config = Constants as unknown as { expoConfig: unknown };
    const original = config.expoConfig;
    config.expoConfig = { extra: {} };
    await expect(registerForPush(jest.fn())).resolves.toBeNull();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    config.expoConfig = original;
  });

  it('si algo falla (p. ej. Expo Go sin push) la app sigue sin avisos', async () => {
    notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('not supported in Expo Go'));
    await expect(registerForPush(jest.fn())).resolves.toBeNull();
  });
});

describe('unregisterPush', () => {
  it('borra el token en la API con la sesión que se cierra', async () => {
    const request = jest.fn().mockResolvedValue(null);
    await unregisterPush(request, TOKEN, 'jwt-1');
    expect(request).toHaveBeenCalledWith('/push-tokens', {
      method: 'DELETE',
      body: { token: TOKEN },
      token: 'jwt-1',
    });
  });
});
