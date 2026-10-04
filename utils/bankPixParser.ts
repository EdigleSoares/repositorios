import type { BankNotificationData } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';

import { SUPPORTED_BANK_PACKAGES } from '@/constants/banks';
import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';

const BANK_NAMES: Record<string, string> = {
  'com.nu.production': 'Nubank',
  'com.itau': 'Itaú',
  'com.bradesco': 'Bradesco',
  'br.com.bradesco.next': 'Bradesco',
  'com.itau.personnalite': 'Itaú',
  'br.com.bb.android': 'Banco do Brasil',
  'com.mercadopago.wallet': 'Mercado Pago',
  'br.gov.caixa.tem': 'Caixa Tem',
  'br.com.gft.caixa': 'Caixa',
  'br.com.intermedium': 'Inter',
  'br.com.uol.ps': 'PagBank',
  'com.c6bank.app': 'C6 Bank',
  'com.bmg.banco.mobile': 'Banco BMG',
  'com.picpay': 'PicPay',
  'com.santander.app': 'Santander',
  'com.neon': 'Neon',
  'br.com.stone.ton': 'Ton / Stone',
  'co.stone.pos.android': 'Ton / Stone',
};

export function getBankName(packageName: string): string {
  return BANK_NAMES[packageName] ?? 'Banco não identificado';
}

const OUTGOING_PATTERN =
  /\b(?:compra(?:s)?|comprou|enviado|enviada|enviei|transferência\s+enviada|transferencia\s+enviada|pix\s+enviado|pix\s+realizado|transferência\s+realizada|transferencia\s+realizada|pagamento\s+realizado|pagou|débito|debito|saída|saida|agendad[oa])\b/iu;
const INCOMING_PATTERN =
  /\b(?:recebemos|recebeu|recebida|recebido|recebimento|crédito|credito|creditado|creditada|entrada|caiu\s+(?:na|em)\s+sua\s+conta|pix\s+recebido|transferência\s+(?:pix\s+)?recebida|transferencia\s+(?:pix\s+)?recebida)\b/iu;
const PAYMENT_AMOUNT_PATTERNS = [
  /R\s*\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)(?![\d,])/iu,
  /\b(?:no\s+valor\s+(?:de\s+)?|valor\s+(?:de\s+)?|recebido\s+)(?:R\s*\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)(?![\d,])/iu,
];
const PAYER_AFTER_AMOUNT_PATTERN =
  /(?:R\s*\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?\s+(?:via\s+)?(?:pix\s+)?de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}?)(?=\s+(?:no\s+valor|valor|às|em)\b|[,.!?;]|$)/iu;
const PAYER_BEFORE_AMOUNT_PATTERN =
  /\b(?:você\s+recebeu\s+(?:um\s+)?pix|pix\s+recebido|transferência\s+(?:pix\s+)?recebida|transferencia\s+(?:pix\s+)?recebida|recebemos\s+sua?\s+transferência|recebemos\s+sua?\s+transferencia|recebido)\s+(?:no\s+valor\s+(?:de\s+)?)?de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,59}?)(?=\s+(?:no\s+valor\s+(?:de\s+)?)?R\s*\$|\s+no\s+valor\b|[,.!?;]|$)/iu;

export { SUPPORTED_BANK_PACKAGES };

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
    .map((content) => PAYMENT_AMOUNT_PATTERNS.map((pattern) => content.match(pattern)?.[1]).find(Boolean))
    .map((value) => (value ? formatarValorMonetario(value) : null))
    .find((value) => value !== null) ?? null;

  const payerText = candidates
    .map((content) => content.match(PAYER_AFTER_AMOUNT_PATTERN)?.[1] ?? content.match(PAYER_BEFORE_AMOUNT_PATTERN)?.[1])
    .find((value) => value !== undefined);
  const payer = payerText ? formatarNomePagador(payerText) : null;

  return { amount, payer };
}
