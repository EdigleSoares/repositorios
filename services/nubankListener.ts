import { Platform } from 'react-native';

import type { NubankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';
import { falarPix } from '@/services/ttsService';
import { NUBANK_PACKAGE, parseNubankNotification, type NubankPixReceipt } from '@/utils/nubankParser';

type NotificationSubscription = {
  remove: () => void;
};

export class NotificationListenerUnavailableError extends Error {
  constructor(cause: unknown) {
    super('O listener do Nubank não está incluído nesta instalação. Use o APK PixFala de desenvolvimento ou preview.');
    this.name = 'NotificationListenerUnavailableError';
    this.cause = cause;
  }
}

async function loadNotificationListener() {
  try {
    const module = await import('@/modules/nubank-notification-listener/src/NubankNotificationListenerModule');
    return module.default;
  } catch (error) {
    if (
      error instanceof Error &&
      /cannot find native module.*NubankNotificationListener/iu.test(error.message)
    ) {
      throw new NotificationListenerUnavailableError(error);
    }
    throw error;
  }
}

export async function hasNotificationAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const listener = await loadNotificationListener();
  return listener.isNotificationPermissionGranted();
}

export async function openNotificationAccessSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('A leitura de notificações está disponível somente no Android.');
  }

  const listener = await loadNotificationListener();
  listener.openNotificationListenerSettings();
}

export async function subscribeToNubankPix(
  isActive: () => boolean,
  onReceipt: (receipt: NubankPixReceipt) => void,
  onError: (error: Error) => void,
): Promise<NotificationSubscription | null> {
  if (Platform.OS !== 'android') return null;

  const nativeListener = await loadNotificationListener();

  const recentNotifications = new Map<string, number>();

  return nativeListener.addListener('onNotificationReceived', (notification: NubankNotificationData) => {
    const receipt = parseNubankNotification(notification);
    if (!receipt || !isActive()) return;

    const signature = [
      notification.key || `${notification.packageName}:${notification.id}`,
      notification.title,
      notification.text,
      notification.bigText,
    ].join('|');
    const now = Date.now();
    const previousTime = recentNotifications.get(signature);
    if (previousTime && now - previousTime < 60_000) return;

    recentNotifications.set(signature, now);
    for (const [key, timestamp] of recentNotifications) {
      if (now - timestamp >= 60_000) recentNotifications.delete(key);
    }
    if (recentNotifications.size > 100) {
      const oldestKey = recentNotifications.keys().next().value;
      if (oldestKey) recentNotifications.delete(oldestKey);
    }

    onReceipt(receipt);
    void falarPix(receipt.amount, receipt.payer).catch((error: unknown) => {
      onError(error instanceof Error ? error : new Error('Não foi possível anunciar o Pix recebido.'));
    });
  });
}
