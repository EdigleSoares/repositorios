import { PermissionsAndroid, Platform } from 'react-native';

import type { BankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';
import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';
import { savePixRecord } from '@/services/pixStorage';
import { falarPix } from '@/services/ttsService';
import type { BankPixReceipt } from '@/utils/bankPixParser';

type NotificationSubscription = {
  remove: () => void;
};

const BANK_PACKAGE_NAMES: Record<string, string> = {
  'com.nu.production': 'Nubank',
  'com.bmg.banco.mobile': 'BMG',
  'br.com.bancobmg.bancodigital': 'BMG',
  'com.neon': 'Neon',
  'com.c6bank.app': 'C6 Bank',
  'br.com.bb.android': 'Banco do Brasil',
  'com.bradesco': 'Bradesco',
  'br.com.bradesco.next': 'Next',
  'com.itau': 'Itaú',
  'com.itau.personnalite': 'Itaú',
  'com.santander.app': 'Santander',
  'com.mercadopago.wallet': 'Mercado Pago',
  'br.gov.caixa.tem': 'Caixa Tem',
  'br.com.gft.caixa': 'Caixa',
  'br.com.intermedium': 'Banco Inter',
  'br.com.uol.ps': 'PagBank',
  'com.picpay': 'PicPay',
  'br.com.stone.ton': 'Ton',
  'co.stone.pos.android': 'Stone',
};
const OUTGOING_PATTERN =
  /\b(?:enviado|enviada|enviou|realizada|efetuado|agendado|comprovante|fatura|compra|cartao|saque|investimento)\w*\b/iu;
const INCOMING_PATTERN =
  /\b(?:pix\s+recebido|recebeu|recebido|recebida|recebemos|credito\s+recebido|transferencia\s+(?:pix\s+)?recebida|voce\s+recebeu)\b/iu;
const AMOUNT_PATTERN = /R\$\s*([\d.,]+)/iu;
const PAYER_PATTERN =
  /\bde\s+(?!R\s*\$)([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,79}?)(?=\s+(?:CPF\b|no\s+valor\b|chave\b|no\s+R\s*\$)|[.!?;]|$)/iu;
const CPF_PATTERN = /(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\*{3}\.\d{3}\.\d{3}-\*{2})/gu;

function normalizeNotificationText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR');
}

function parsePixNotification(
  notification: BankNotificationData,
  bankName: string,
): (BankPixReceipt & { rawText: string }) | null {
  const rawText = [notification.title, notification.text, notification.bigText]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join('\n');
  const searchableTexts = [
    notification.text,
    notification.bigText,
    notification.title,
    notification.subText,
    notification.summaryText,
  ]
    .map((value) => value.replace(/\s+/gu, ' ').trim())
    .filter((value, index, texts) => value.length > 0 && texts.indexOf(value) === index);
  const combinedText = searchableTexts.join(' ');
  const normalizedText = normalizeNotificationText(combinedText);

  console.log('[PixFala][listener] Verificando notificação', {
    packageName: notification.packageName,
    bankName,
  });
  if (OUTGOING_PATTERN.test(normalizedText)) {
    console.log('[PixFala][listener] Descartada: padrão de saída/pagamento detectado', { bankName });
    return null;
  }
  if (!INCOMING_PATTERN.test(normalizedText)) {
    console.log('[PixFala][listener] Descartada: nenhum padrão de recebimento detectado', { bankName });
    return null;
  }

  console.log('[PixFala][listener] Padrão de recebimento confirmado', { bankName });

  const amountText = searchableTexts
    .map((text) => text.match(AMOUNT_PATTERN)?.[1])
    .find((value) => value !== undefined)
    ?.replace(/[.,]+$/u, '');
  const amount = amountText ? formatarValorMonetario(amountText) : null;
  if (!amount) {
    console.log('[PixFala][listener] Descartada: valor ausente ou inválido', { bankName });
    return null;
  }
  console.log('[PixFala][listener] Valor extraído', { bankName, amount });

  const payerText = searchableTexts
    .map((text) => text.replace(CPF_PATTERN, ' ').match(PAYER_PATTERN)?.[1])
    .find((value) => value !== undefined);
  const payer = payerText ? formatarNomePagador(payerText) : null;
  const fullPayerName = payer ?? 'Cliente';
  console.log('[PixFala][listener] Nome do pagador extraído', { bankName, hasPayer: payer !== null });

  return { amount, payer: fullPayerName, rawText };
}

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

export async function isPixMonitoringEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const listener = await loadNotificationListener();
  return listener.isMonitoringEnabled();
}

export async function setPixMonitoringEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;

  const listener = await loadNotificationListener();
  listener.setMonitoringEnabled(enabled);
}

export async function hasOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const listener = await loadNotificationListener();
  return listener.isOverlayPermissionGranted();
}

export async function requestOverlayPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('A permissão de sobreposição está disponível somente no Android.');
  }

  const listener = await loadNotificationListener();
  listener.openOverlayPermissionSettings();
}

export async function showPixReceiptOverlay(amount: string, payer: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  const listener = await loadNotificationListener();
  if (!listener.isOverlayPermissionGranted()) {
    throw new Error('Conceda a permissão de sobreposição para exibir a confirmação do Pix.');
  }
  listener.showPixOverlay(amount, payer);
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
      console.log('[PixFala][listener] Permissão de notificação negada; a fala nativa continua ativa.');
    }
  }

  nativeListener.startForegroundTracking();
  const recentNotifications = new Map<string, number>();

  const subscription = nativeListener.addListener('onNotificationReceived', (notification: BankNotificationData) => {
    const notificationDetails = {
      packageName: notification.packageName,
      id: notification.id,
    };
    console.log('[PixFala][listener] Notificação capturada', notificationDetails);

    void (async () => {
      const bankName = BANK_PACKAGE_NAMES[notification.packageName];
      const sourceName = bankName ?? notification.packageName;
      console.log('[PixFala][listener] Pacote de origem reconhecido', { ...notificationDetails, sourceName });

      if (!isActive()) {
        console.log('[PixFala][listener] Notificação ignorada: escuta pausada', notificationDetails);
        return;
      }

      const receipt = parsePixNotification(notification, sourceName);
      if (!receipt) {
        return;
      }

      let javascriptSpeechClaimed = false;
      let canUseJavascriptSpeech = true;
      let nativeQueueDurable = false;
      if (notification.key) {
        try {
          let speechRoute = nativeListener.claimJavascriptSpeech(
            notification.key,
            notification.postTime,
          );
          nativeQueueDurable = speechRoute !== 'not-found';
          if (speechRoute === 'not-found') {
            nativeQueueDurable = nativeListener.enqueueJavascriptFallback(
              notification.key,
              notification.postTime,
              notification.packageName,
              receipt.amount,
              receipt.payer,
            );
            speechRoute = nativeListener.claimJavascriptSpeech(
              notification.key,
              notification.postTime,
            );
            nativeQueueDurable ||= speechRoute !== 'not-found';
          }
          javascriptSpeechClaimed = speechRoute === 'claimed';
          canUseJavascriptSpeech =
            speechRoute === 'claimed' || speechRoute === 'not-found';
        } catch (error) {
          canUseJavascriptSpeech = !nativeQueueDurable;
          console.warn('[PixFala][listener] Não foi possível selecionar a fala Expo; o TTS nativo seguirá', {
            ...notificationDetails,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
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
        if (javascriptSpeechClaimed && notification.key) {
          nativeListener.releaseJavascriptSpeech(notification.key, notification.postTime);
        }
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
        const timestamp = Number.isFinite(notification.postTime) && notification.postTime > 0
          ? new Date(notification.postTime).toISOString()
          : new Date().toISOString();
        await savePixRecord({
          valor: receipt.amount,
          nomePagador: receipt.payer,
          banco: sourceName,
          timestamp,
          packageName: notification.packageName,
          rawNotificationText: receipt.rawText,
        });
        console.log('[PixFala][listener] Pix salvo no relatório', {
          bankName,
          amount: receipt.amount,
          payer: receipt.payer,
        });
        if (notification.key) {
          try {
            nativeListener.confirmPixStored(notification.key, notification.postTime);
          } catch (error) {
            console.log('[PixFala][listener] A fala nativa seguirá após o tempo de segurança', {
              ...notificationDetails,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
            });
          }
        }
      } catch (error) {
        recentNotifications.delete(signature);
        if (javascriptSpeechClaimed && notification.key) {
          nativeListener.releaseJavascriptSpeech(notification.key, notification.postTime);
        }
        const detail = error instanceof Error ? error.message : 'Erro desconhecido ao salvar o histórico.';
        console.log('[PixFala][listener] Falha ao salvar o Pix recebido', {
          ...notificationDetails,
          error: detail,
        });
        onError(new Error(`Não foi possível salvar o Pix no relatório: ${detail}`));
        return;
      }

      try {
        onReceipt?.(receipt);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Não foi possível atualizar o estado do Pix.'));
      }

      if (canUseJavascriptSpeech) {
        try {
          await falarPix(receipt.amount, receipt.payer);
          if (javascriptSpeechClaimed && notification.key) {
            const acknowledged = nativeListener.completeJavascriptSpeech(
              notification.key,
              notification.postTime,
            );
            if (!acknowledged) {
              console.warn('[PixFala][listener] Voz JS terminou, mas a fila nativa não confirmou o Pix', {
                ...notificationDetails,
              });
            }
          }
          console.log('[PixFala][listener] Anúncio de voz concluído pelo Expo Speech', {
            ...notificationDetails,
            bankName: sourceName,
            amount: receipt.amount,
          });
          if (!nativeQueueDurable && bankName && notification.key) {
            try {
              nativeListener.cancelNotification(notification.key);
              console.log('[PixFala][listener] Notificação removida após fala concluída sem fila nativa', {
                ...notificationDetails,
                bankName,
              });
            } catch (cancelError) {
              console.warn('[PixFala][listener] Não foi possível remover a notificação após a fala', {
                ...notificationDetails,
                bankName,
                error: cancelError instanceof Error ? cancelError.message : 'Erro desconhecido',
              });
            }
          }
        } catch (error) {
          if (javascriptSpeechClaimed && notification.key) {
            nativeListener.releaseJavascriptSpeech(notification.key, notification.postTime);
          }
          console.error('[PixFala][listener] Expo Speech falhou; o TTS nativo tentará anunciar', {
            ...notificationDetails,
            error,
          });
          onError(error instanceof Error ? error : new Error('Não foi possível anunciar o Pix recebido.'));
        }
      } else {
        console.log('[PixFala][listener] O TTS nativo ficou responsável pelo anúncio', {
          ...notificationDetails,
          bankName: sourceName,
          amount: receipt.amount,
        });
      }

      try {
        await showPixReceiptOverlay(receipt.amount, receipt.payer);
        console.log('[PixFala][listener] Confirmação flutuante exibida', { sourceName });
      } catch (error) {
        console.log('[PixFala][listener] Não foi possível exibir a confirmação flutuante', {
          sourceName,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
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
