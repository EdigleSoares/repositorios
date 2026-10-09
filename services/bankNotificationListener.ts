import { PermissionsAndroid, Platform } from 'react-native';

import type {
  BankNotificationData,
  PendingPixReport,
} from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';
import { SUPPORTED_BANK_PACKAGES } from '@/constants/banks';
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
const EXPLICIT_PIX_PATTERN = /\bpix\b/iu;
const TRANSFER_RECEIVED_PATTERN =
  /\btransferencia\s+(?:pix\s+)?recebida\b|\brecebemos sua transferencia\b|\bvoce recebeu uma transferencia\b/iu;
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
  const rawText = [
    notification.title,
    notification.text,
    notification.bigText,
    ...(notification.textLines ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join('\n');
  const searchableTexts = [
    ...(notification.textLines ?? []).map((line) => `${notification.title} ${line}`),
    `${notification.title} ${notification.text}`,
    `${notification.title} ${notification.bigText}`,
    notification.text,
    notification.bigText,
    notification.title,
    notification.subText,
    notification.summaryText,
  ]
    .map((value) => value.replace(/\s+/gu, ' ').trim())
    .filter((value, index, texts) => value.length > 0 && texts.indexOf(value) === index);

  console.log('[PixFala][listener] Verificando notificação', {
    packageName: notification.packageName,
    bankName,
  });
  const receiptText = searchableTexts.find((text) => {
    const normalizedText = normalizeNotificationText(text);
    if (OUTGOING_PATTERN.test(normalizedText) || !INCOMING_PATTERN.test(normalizedText)) return false;
    return EXPLICIT_PIX_PATTERN.test(normalizedText) ||
      TRANSFER_RECEIVED_PATTERN.test(normalizedText);
  });
  if (!receiptText) {
    console.log('[PixFala][listener] Descartada: nenhum padrão de recebimento detectado', { bankName });
    return null;
  }

  console.log('[PixFala][listener] Padrão de recebimento confirmado', { bankName });

  const amountText = receiptText.match(AMOUNT_PATTERN)?.[1]?.replace(/[.,]+$/u, '');
  const amount = amountText ? formatarValorMonetario(amountText) : null;
  if (!amount) {
    console.log('[PixFala][listener] Descartada: valor ausente ou inválido', { bankName });
    return null;
  }
  console.log('[PixFala][listener] Valor válido extraído', { bankName });

  const payerText = receiptText.replace(CPF_PATTERN, ' ').match(PAYER_PATTERN)?.[1];
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

type NativeNotificationListener = Awaited<ReturnType<typeof loadNotificationListener>>;

function getPixRecordId(
  eventId: string,
  notificationKey?: string,
  postTime?: number,
  packageName?: string,
): string {
  if (!eventId.startsWith('pix-') && notificationKey && packageName && postTime !== undefined) {
    return `notification:${encodeURIComponent(packageName)}:${postTime}:${encodeURIComponent(notificationKey)}`;
  }
  return `notification:${encodeURIComponent(eventId)}`;
}

function createPixEventId(
  notificationKey: string,
  postTime: number,
  packageName: string,
  amount: string,
  payer: string,
): string {
  return [
    'pix-js',
    encodeURIComponent(notificationKey),
    String(postTime),
    encodeURIComponent(packageName),
    encodeURIComponent(amount),
    encodeURIComponent(payer),
  ].join(':');
}

async function persistPendingPixReport(report: PendingPixReport): Promise<void> {
  const bankName = BANK_PACKAGE_NAMES[report.packageName] ?? 'Banco não identificado';
  await savePixRecord({
    id: getPixRecordId(
      report.eventId,
      report.notificationKey,
      report.postTime,
      report.packageName,
    ),
    valor: report.amount,
    nomePagador: report.payer,
    banco: bankName,
    timestamp: Number.isFinite(report.postTime) && report.postTime > 0
      ? new Date(report.postTime).toISOString()
      : new Date().toISOString(),
    packageName: report.packageName,
  });
}

async function syncPendingPixReports(
  nativeListener: NativeNotificationListener,
  onError: (error: Error) => void,
): Promise<void> {
  let pendingReports: PendingPixReport[];
  try {
    pendingReports = nativeListener.getPendingPixReports();
  } catch (error) {
    onError(error instanceof Error
      ? new Error(`Não foi possível recuperar Pix pendentes do diário local: ${error.message}`)
      : new Error('Não foi possível recuperar Pix pendentes do diário local.'));
    return;
  }

  let syncedCount = 0;
  let failedCount = 0;
  for (const report of pendingReports) {
    try {
      await persistPendingPixReport(report);
      if (!nativeListener.markPixReportStored(report.eventId)) {
        throw new Error('O diário local não confirmou o registro no relatório.');
      }
      syncedCount += 1;
    } catch (error) {
      failedCount += 1;
      onError(error instanceof Error
        ? new Error(`Não foi possível sincronizar um Pix pendente: ${error.message}`)
        : new Error('Não foi possível sincronizar um Pix pendente.'));
    }
  }

  if (pendingReports.length > 0) {
    console.log('[PixFala][listener] Sincronização do diário local finalizada', {
      syncedCount,
      failedCount,
    });
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
  const recentEventIds = new Map<string, number>();

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
        if (SUPPORTED_BANK_PACKAGES.has(notification.packageName)) {
          void syncPendingPixReports(nativeListener, onError);
        }
        return;
      }

      const eventId = notification.eventId ?? createPixEventId(
        notification.key,
        notification.postTime,
        notification.packageName,
        receipt.amount,
        receipt.payer,
      );
      const now = Date.now();
      const previousTime = recentEventIds.get(eventId);
      if (previousTime && now - previousTime < 60_000) {
        console.log('[PixFala][listener] Notificação ignorada: evento duplicado', notificationDetails);
        return;
      }

      recentEventIds.set(eventId, now);
      for (const [key, timestamp] of recentEventIds) {
        if (now - timestamp >= 60_000) recentEventIds.delete(key);
      }
      if (recentEventIds.size > 100) {
        const oldestKey = recentEventIds.keys().next().value;
        if (oldestKey) recentEventIds.delete(oldestKey);
      }

      let nativeQueueDurable = false;
      if (notification.key) {
        try {
          nativeQueueDurable = nativeListener.ensurePixSpeechQueued(
            eventId,
            notification.key,
            notification.postTime,
            notification.packageName,
            receipt.amount,
            receipt.payer,
          );
        } catch (error) {
          console.warn('[PixFala][listener] Não foi possível confirmar a fila nativa; o Expo Speech será usado', {
            ...notificationDetails,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      }

      let reportStored = false;
      try {
        const timestamp = Number.isFinite(notification.postTime) && notification.postTime > 0
          ? new Date(notification.postTime).toISOString()
          : new Date().toISOString();
        await savePixRecord({
          ...(notification.key
            ? { id: getPixRecordId(eventId) }
            : {}),
          valor: receipt.amount,
          nomePagador: receipt.payer,
          banco: sourceName,
          timestamp,
          packageName: notification.packageName,
          rawNotificationText: receipt.rawText,
        });
        console.log('[PixFala][listener] Pix salvo no relatório', {
          bankName,
        });
        reportStored = true;
      } catch (error) {
        recentEventIds.delete(eventId);
        const detail = error instanceof Error ? error.message : 'Erro desconhecido ao salvar o histórico.';
        console.log('[PixFala][listener] Falha ao salvar o Pix recebido', {
          ...notificationDetails,
          error: detail,
        });
        onError(new Error(`Não foi possível salvar o Pix no relatório: ${detail}`));
      }

      if (reportStored && nativeQueueDurable && notification.key) {
        try {
          if (!nativeListener.markPixReportStored(eventId)) {
            throw new Error('O diário local não confirmou o registro no relatório.');
          }
        } catch (error) {
          onError(error instanceof Error
            ? new Error(`O Pix foi salvo, mas a fila local não confirmou a sincronização: ${error.message}`)
            : new Error('O Pix foi salvo, mas a fila local não confirmou a sincronização.'));
        }
      }

      try {
        onReceipt?.(receipt);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Não foi possível atualizar o estado do Pix.'));
      }

      if (!nativeQueueDurable) {
        try {
          await falarPix(receipt.amount, receipt.payer);
          console.log('[PixFala][listener] Anúncio de voz concluído pelo Expo Speech', {
            ...notificationDetails,
            bankName: sourceName,
          });
          if (reportStored && bankName && notification.key) {
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
          console.error('[PixFala][listener] Expo Speech falhou; o Pix não pôde ser anunciado', {
            ...notificationDetails,
            error,
          });
          onError(error instanceof Error ? error : new Error('Não foi possível anunciar o Pix recebido.'));
        }
      } else {
        console.log('[PixFala][listener] O TTS nativo ficou responsável pelo anúncio', {
          ...notificationDetails,
          bankName: sourceName,
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

  void syncPendingPixReports(nativeListener, onError);

  return {
    remove: () => {
      subscription.remove();
      nativeListener.stopForegroundTracking();
    },
  };
}
