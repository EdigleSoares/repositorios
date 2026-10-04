import { Platform } from 'react-native';

import type { BankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';
import { savePixRecord } from '@/services/pixStorage';
import { falarPix } from '@/services/ttsService';
import {
  getBankName,
  parseBankNotification,
  type BankPixReceipt,
} from '@/utils/bankPixParser';

type NotificationSubscription = {
  remove: () => void;
};

export class NotificationListenerUnavailableError extends Error {
  constructor(cause: unknown) {
    super('O listener de notificações não está incluído nesta instalação. Use o APK PixFala de desenvolvimento ou preview.');
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

export async function subscribeToBankPix(
  isActive: () => boolean,
  onReceipt: ((receipt: BankPixReceipt) => void) | undefined,
  onError: (error: Error) => void,
): Promise<NotificationSubscription | null> {
  if (Platform.OS !== 'android') return null;

  const nativeListener = await loadNotificationListener();
  const recentNotifications = new Map<string, number>();

  return nativeListener.addListener('onNotificationReceived', (notification: BankNotificationData) => {
    const receipt = parseBankNotification(notification);
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

    void (async () => {
      try {
        await falarPix(receipt.amount ?? undefined, receipt.payer ?? undefined);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Não foi possível anunciar o Pix recebido.'));
        return;
      }

      try {
        const timestamp = Number.isFinite(notification.postTime) && notification.postTime > 0
          ? new Date(notification.postTime).toISOString()
          : new Date().toISOString();
        await savePixRecord({
          valor: receipt.amount ?? 'Não informado',
          nomePagador: receipt.payer ?? 'Não informado',
          banco: getBankName(notification.packageName),
          timestamp,
        });
        onReceipt?.(receipt);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Erro desconhecido ao salvar o histórico.';
        onError(new Error(`O Pix foi anunciado, mas não foi possível salvar o registro: ${detail}`));
      }
    })();
  });
}
