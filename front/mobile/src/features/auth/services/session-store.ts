import * as SecureStore from 'expo-secure-store';
import type { PublicUser } from '@/shared/interfaces/public-user.interface';

export interface StoredSession {
  token: string;
  user: PublicUser;
}

const KEY = 'cobrale.session';
/** Keychain / Keystore: no se respalda ni pasa a otro teléfono. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token === 'string' && parsed.user && typeof parsed.user.id === 'number')
      return { token: parsed.token, user: parsed.user };
  } catch {
    // Dañado: se borra abajo.
  }
  await clearSession();
  return null;
}

export function saveSession(session: StoredSession): Promise<void> {
  return SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
}

export function clearSession(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY, OPTIONS);
}
