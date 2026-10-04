import type { NubankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';

import {
  extrairValorMonetario,
  formatarNomePagador,
  formatarValorMonetario,
} from '@/utils/pixFormatter';

export const NUBANK_PACKAGE = 'com.nu.production';

const RECEIPT_PATTERNS = [
  /(?:recebemos\s+sua?\s+transferência|você\s+recebeu\s+(?:uma\s+)?transferência|transferência\s+recebida)\s*(?:de\s*)?((?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)(?:\s+de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}))?[.!?]*$/iu,
  /\bpix\s+recebido\s*:?\s*((?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)(?:\s+de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}))?[.!?]*$/iu,
];

export type NubankPixReceipt = {
  amount: string | null;
  payer: string | null;
};

export function parseNubankNotification(
  notification: Pick<NubankNotificationData, 'packageName' | 'title' | 'text' | 'bigText' | 'subText' | 'summaryText'>,
): NubankPixReceipt | null {
  if (notification.packageName !== NUBANK_PACKAGE) return null;

  const { title, text, bigText, subText, summaryText } = notification;
  const candidates = [
    bigText,
    text,
    subText,
    summaryText,
    title,
    `${title} ${text}`,
    `${title} ${bigText}`,
    `${title} ${subText}`,
    `${title} ${summaryText}`,
  ]
    .map((content) => content.replace(/\s+/gu, ' ').trim())
    .filter((content, index, all) => content.length > 0 && all.indexOf(content) === index);

  for (const content of candidates) {
    for (const pattern of RECEIPT_PATTERNS) {
      const match = content.match(pattern);
      if (!match) continue;

      const amount = formatarValorMonetario(match[1]);
      const payer = match[2] ? formatarNomePagador(match[2].replace(/[.!?]+\s*$/u, '')) : null;
      if (amount) return { amount, payer };
    }
  }

  const allContent = candidates.join(' ');
  if (!/\b(?:transferência|pix)\b/iu.test(allContent)) return null;

  const amount = candidates.map(extrairValorMonetario).find((value) => value !== null) ?? null;
  return { amount, payer: null };
}
