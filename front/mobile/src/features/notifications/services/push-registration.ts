import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ApiRequest } from '@/shared/api/api-client';

/** Canal de Android para "Pago recibido". */
export const PAYMENTS_CHANNEL = 'pagos';

function easProjectId(): string | null {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)?.eas
    ?.projectId;
  const id = fromConfig ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Registra este teléfono para recibir "Pago recibido". Devuelve el token de
 * Expo o null si no se puede (simulador, permiso negado, sin proyecto de EAS o
 * Expo Go). Nunca truena: los avisos son un extra, cobrar funciona sin ellos.
 */
export async function registerForPush(request: ApiRequest): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync(PAYMENTS_CHANNEL, {
        name: 'Pagos recibidos',
        // Se exporta con export * desde sus tipos; el plugin de import no lo sigue.
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.HIGH,
      });

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain !== false)
      permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return null;

    const projectId = easProjectId();
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await request('/push-tokens', { method: 'POST', body: { token } });
    return token;
  } catch {
    return null;
  }
}

/** Al salir: este teléfono deja de recibir avisos de esa cuenta. */
export async function unregisterPush(request: ApiRequest, pushToken: string, sessionToken: string): Promise<void> {
  await request('/push-tokens', { method: 'DELETE', body: { token: pushToken }, token: sessionToken });
}
