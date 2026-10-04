import type { BankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';

import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';

export const SUPPORTED_BANK_PACKAGES = new Set([
  'com.nu.production',
  'com.itau',
  'com.bradesco',
  'br.com.bb.android',
  'com.mercadopago.wallet',
  'br.gov.caixa.tem',
  'br.com.gft.caixa',
  'br.com.intermedium',
  'br.com.uol.ps',
]);

const BANK_NAMES: Record<string, string> = {
  'com.nu.production': 'Nubank',
  'com.itau': 'Itaú',
  'com.bradesco': 'Bradesco',
  'br.com.bb.android': 'Banco do Brasil',
  'com.mercadopago.wallet': 'Mercado Pago',
  'br.gov.caixa.tem': 'Caixa Tem',
  'br.com.gft.caixa': 'Caixa',
  'br.com.intermedium': 'Inter',
  'br.com.uol.ps': 'PagBank',
};

export function getBankName(packageName: string): string {
  return BANK_NAMES[packageName] ?? 'Banco não identificado';
}

const OUTGOING_PATTERN =
  /\b(?:compra(?:s)?|comprou|enviado|enviada|enviei|transferência\s+enviada|transferencia\s+enviada|pix\s+enviado|pix\s+realizado|transferência\s+realizada|transferencia\s+realizada|pagamento\s+realizado|pagou|débito|debito|saída|saida|agendad[oa])\b/iu;
const INCOMING_PATTERN =
  /\b(?:recebemos|recebeu|recebida|recebido|recebimento|crédito|credito|creditado|creditada|entrada|caiu\s+(?:na|em)\s+sua\s+conta)\b/iu;
const PAYMENT_AMOUNT_PATTERN =
  /(?:^|[^\d.,])((?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)(?![\d,])/iu;
const PAYER_AFTER_AMOUNT_PATTERN =
  /(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?\s+(?:via\s+)?(?:pix\s+)?de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}?)(?=\s+(?:no\s+valor|valor|às|em)\b|[,.!?;]|$)/iu;
const PAYER_BEFORE_AMOUNT_PATTERN =
  /\b(?:pix\s+recebido|transferência\s+recebida|transferencia\s+recebida|recebemos\s+sua?\s+transferência|recebemos\s+sua?\s+transferencia)\s+de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}?)(?=\s+(?:no\s+valor\s+de\s+)?R\$|\s+no\s+valor\b|[,.!?;]|$)/iu;

export type BankPixReceipt = {
  amount: string | null;
  payer: string | null;
};

function getNotificationContent(notification: BankNotificationData): string[] {
  const { title, text, bigText, subText, summaryText } = notification;
  return [bigText, text, subText, summaryText, title, `${title} ${text}`, `${title} ${bigText}`]
    .map((content) => content.replace(/\s+/gu, ' ').trim())
    .filter((content, index, all) => content.length > 0 && all.indexOf(content) === index);
}

export function parseBankNotification(notification: BankNotificationData): BankPixReceipt | null {
  if (!SUPPORTED_BANK_PACKAGES.has(notification.packageName)) return null;

  const candidates = getNotificationContent(notification);
  const allContent = candidates.join(' ');
  if (OUTGOING_PATTERN.test(allContent) || !INCOMING_PATTERN.test(allContent)) return null;

  const amount = candidates
    .map((content) => content.match(PAYMENT_AMOUNT_PATTERN)?.[1])
    .map((value) => (value ? formatarValorMonetario(value) : null))
    .find((value) => value !== null) ?? null;

  const payerText = candidates
    .map((content) => content.match(PAYER_AFTER_AMOUNT_PATTERN)?.[1] ?? content.match(PAYER_BEFORE_AMOUNT_PATTERN)?.[1])
    .find((value) => value !== undefined);
  const payer = payerText ? formatarNomePagador(payerText) : null;

  return { amount, payer };
}
