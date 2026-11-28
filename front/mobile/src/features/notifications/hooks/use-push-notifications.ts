import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import type { ApiRequest } from '@/shared/api/api-client';
import { chargeIdFromNotification } from '../policies/notification-target.policy';
import { registerForPush, unregisterPush } from '../services/push-registration';

// Con la app abierta también se muestra el aviso de pago.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Token de avisos de este teléfono, para borrarlo al salir. */
let currentPushToken: string | null = null;

/** Para el onSignOut de la sesión: borra el token de avisos con la sesión que se cierra. */
export function forgetPushToken(request: ApiRequest) {
  return async (sessionToken: string) => {
    const pushToken = currentPushToken;
    currentPushToken = null;
    if (pushToken) await unregisterPush(request, pushToken, sessionToken);
  };
}

/**
 * Con sesión: registra el teléfono para "Pago recibido" y, al tocar un aviso
 * (también con la app cerrada), abre ese cobro.
 */
export function usePushNotifications(authedRequest: ApiRequest, signedInUserId: number | null) {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (signedInUserId === null) return;
    let cancelled = false;
    void registerForPush(authedRequest).then((token) => {
      if (!cancelled) currentPushToken = token;
    });
    return () => {
      cancelled = true;
    };
    // Una vez por persona con sesión; authedRequest cambia con cada token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInUserId]);

  useEffect(() => {
    if (signedInUserId === null || !response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const chargeId = chargeIdFromNotification(response.notification.request.content.data);
    if (chargeId) router.push(`/cobros/${chargeId}`);
    Notifications.clearLastNotificationResponse();
  }, [response, signedInUserId, router]);
}
