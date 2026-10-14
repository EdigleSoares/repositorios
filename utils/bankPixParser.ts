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
  'br.com.bancobmg.bancodigital': 'Banco BMG',
  'com.picpay': 'PicPay',
  'com.santander.app': 'Santander',
  'com.neon': 'Neon',
  'br.com.neon': 'Neon',
  'br.com.stone.ton': 'Ton / Stone',
  'co.stone.pos.android': 'Ton / Stone',
};

export function getBankName(packageName: string): string {
  return BANK_NAMES[packageName] ?? 'Banco não identificado';
}

const OUTGOING_PATTERN =
  /\b(?:pix\s+(?:enviado|enviada|efetuado|efetuada|realizado|realizada|feito|feita)|transfer[eê]ncia\s+(?:pix\s+)?(?:enviada|realizada)|enviado|enviada|enviou|enviei|paga\w*|realizado\s+com\s+sucesso|realizado|realizada|realizou|efetuado|efetuada|efetuou|comprovante|fatura|compra(?:s)?|comprou|pagou|pagamento\s+(?:realizado|efetuado)|débito|debito|saída|saida|investimento|agendad[oa])\b/iu;
const INCOMING_PATTERN =
  /\b(?:recebemos|recebeu|recebida|recebido|recebimento|crédito|credito|creditado|creditada|entrada|caiu\s+(?:na|em)\s+sua\s+conta|pix\s+recebido|transferência\s+(?:pix\s+)?recebida|transferencia\s+(?:pix\s+)?recebida)\b/iu;
const EXPLICIT_PIX_PATTERN = /\bpix\b/iu;
const TRANSFER_RECEIVED_PATTERN =
  /\btransfer[eê]ncia\s+(?:pix\s+)?recebida\b|\brecebemos sua transfer[eê]ncia\b|\bvoc[eê] recebeu uma transfer[eê]ncia\b/iu;
const PAYMENT_AMOUNT_PATTERN = /R\$\s*([\d.,]+)/iu;
const PAYER_NAME_PATTERN =
  /\bde\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,79}?)(?=\s+(?:CPF\b|no\s+valor\b|no\s+R\s*\$|chave\b)|[.!?;]|$)/iu;
const PAYER_AFTER_AMOUNT_PATTERN =
  /R\$\s*[\d.,]+\s+(?:via\s+)?(?:pix\s+)?de\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,79}?)(?=\s+(?:CPF\b|no\s+valor\b|no\s+R\s*\$|chave\b)|[.!?;]|$)/iu;

export { SUPPORTED_BANK_PACKAGES };

export type BankPixReceipt = {
  amount: string;
  payer: string;
};

function getNotificationContent(notification: BankNotificationData): string[] {
  const { title, text, bigText, subText, summaryText } = notification;
  return [
    ...(notification.textLines ?? []).map((line) => `${title} ${line}`),
    bigText,
    text,
    subText,
    summaryText,
    title,
    `${title} ${text}`,
    `${title} ${bigText}`,
  ]
    .map((content) => content.replace(/\s+/gu, ' ').trim())
    .filter((content, index, all) => content.length > 0 && all.indexOf(content) === index);
}

export function parseBankNotification(notification: BankNotificationData): BankPixReceipt | null {
  if (!SUPPORTED_BANK_PACKAGES.has(notification.packageName)) return null;

  const candidates = getNotificationContent(notification);
  const receiptContent = candidates.find((content) => {
    if (OUTGOING_PATTERN.test(content) || !INCOMING_PATTERN.test(content)) return false;
    return EXPLICIT_PIX_PATTERN.test(content) || TRANSFER_RECEIVED_PATTERN.test(content);
  });
  if (!receiptContent) return null;

  const amountValue = receiptContent.match(PAYMENT_AMOUNT_PATTERN)?.[1];
  const amount = amountValue
    ? formatarValorMonetario(amountValue.replace(/[.,]+$/u, ''))
    : null;

  if (!amount) return null;

  const payerText =
    receiptContent.match(PAYER_NAME_PATTERN)?.[1] ??
    receiptContent.match(PAYER_AFTER_AMOUNT_PATTERN)?.[1];
  const payer = payerText ? formatarNomePagador(payerText) : null;

  return { amount, payer: payer ?? 'Cliente' };
}
