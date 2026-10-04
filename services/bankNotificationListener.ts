import { PermissionsAndroid, Platform } from 'react-native';

import type { BankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';
import { ALL_BANKS_ID, getBankForPackage, SUPPORTED_BANK_PACKAGES } from '@/constants/banks';
import { getSelectedBankId } from '@/services/bankSelection';
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

export async function hasBatteryOptimizationExemption(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const listener = await loadNotificationListener();
  return listener.isIgnoringBatteryOptimizations();
}

export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('A configuração de otimização de bateria está disponível somente no Android.');
  }

  const listener = await loadNotificationListener();
  listener.requestIgnoreBatteryOptimizations();
}

export async function subscribeToBankPix(
  isActive: () => boolean,
  onReceipt: ((receipt: BankPixReceipt) => void) | undefined,
  onError: (error: Error) => void,
): Promise<NotificationSubscription | null> {
  if (Platform.OS !== 'android') return null;

  const nativeListener = await loadNotificationListener();
  if (!nativeListener.isNotificationPermissionGranted()) {
    throw new Error('Conceda o acesso às notificações do PixFala antes de iniciar a escuta.');
  }

  if (Platform.Version >= 33) {
    const notificationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (notificationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Conceda a permissão de notificações para exibir o aviso persistente do PixFala.');
    }
  }

  nativeListener.startForegroundTracking();
  const recentNotifications = new Map<string, number>();

  const subscription = nativeListener.addListener('onNotificationReceived', (notification: BankNotificationData) => {
    const notificationDetails = {
      packageName: notification.packageName,
      title: notification.title,
      text: notification.text,
      bigText: notification.bigText,
    };
    console.log('[PixFala][listener] Notificação capturada', notificationDetails);

    void (async () => {
      let selectedBankId: string;
      try {
        selectedBankId = await getSelectedBankId();
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log('[PixFala][listener] Notificação ignorada: falha ao ler banco selecionado', {
          ...notificationDetails,
          error: detail,
        });
        onError(new Error(`Não foi possível verificar o banco selecionado: ${detail}`));
        return;
      }

      if (!SUPPORTED_BANK_PACKAGES.has(notification.packageName)) {
        console.log('[PixFala][listener] Notificação ignorada: pacote não suportado', notificationDetails);
        return;
      }

      const bank = getBankForPackage(notification.packageName);
      if (
        !bank ||
        (selectedBankId !== ALL_BANKS_ID && selectedBankId !== bank.id)
      ) {
        console.log('[PixFala][listener] Notificação ignorada: banco diferente da seleção', {
          ...notificationDetails,
          selectedBankId,
          notificationBankId: bank?.id ?? 'unknown',
        });
        return;
      }

      if (!isActive()) {
        console.log('[PixFala][listener] Notificação ignorada: escuta pausada', notificationDetails);
        return;
      }

      const receipt = parseBankNotification(notification);
      if (!receipt) {
        console.log('[PixFala][listener] Notificação ignorada: não foi identificado Pix recebido', notificationDetails);
        return;
      }

      const signature = [
        notification.key || `${notification.packageName}:${notification.id}`,
        notification.title,
        notification.text,
        notification.bigText,
      ].join('|');
      const now = Date.now();
      const previousTime = recentNotifications.get(signature);
      if (previousTime && now - previousTime < 60_000) {
        console.log('[PixFala][listener] Notificação ignorada: evento duplicado', notificationDetails);
        return;
      }

      recentNotifications.set(signature, now);
      for (const [key, timestamp] of recentNotifications) {
        if (now - timestamp >= 60_000) recentNotifications.delete(key);
      }
      if (recentNotifications.size > 100) {
        const oldestKey = recentNotifications.keys().next().value;
        if (oldestKey) recentNotifications.delete(oldestKey);
      }

      try {
        await falarPix(receipt.amount ?? undefined, receipt.payer ?? undefined);
      } catch (error) {
        console.log('[PixFala][listener] Falha no anúncio de voz', { ...notificationDetails, error });
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
        console.log('[PixFala][listener] Falha ao salvar o Pix anunciado', {
          ...notificationDetails,
          error: detail,
        });
        onError(new Error(`O Pix foi anunciado, mas não foi possível salvar o registro: ${detail}`));
      }
    })();
  });

  return {
    remove: () => {
      subscription.remove();
      nativeListener.stopForegroundTracking();
    },
  };
}
