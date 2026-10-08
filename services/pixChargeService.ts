import * as SecureStore from 'expo-secure-store';
import { createStaticPix, hasError, isStaticPix, parsePix } from 'pix-utils';

const PIX_CHARGE_CONFIG_KEY = 'pixfala_pix_charge_config';

export type PixKeyType = 'CPF' | 'CNPJ' | 'Telefone' | 'E-mail' | 'Chave aleatória';

export type PixChargeConfig = {
  pixKey: string;
  pixKeyType: PixKeyType;
  merchantName: string;
  merchantCity: string;
};

export type PixChargeConfigInput = Omit<PixChargeConfig, 'pixKeyType'>;

function isRepeatedDigit(value: string): boolean {
  return /^(\d)\1+$/u.test(value);
}

function calculateCheckDigit(digits: string, weights: number[]): number {
  const remainder = digits
    .split('')
    .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/u.test(value) || isRepeatedDigit(value)) return false;
  const firstDigit = calculateCheckDigit(value.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCheckDigit(
    value.slice(0, 10),
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return value.endsWith(`${firstDigit}${secondDigit}`);
}

function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/u.test(value) || isRepeatedDigit(value)) return false;
  const firstDigit = calculateCheckDigit(
    value.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondDigit = calculateCheckDigit(
    value.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return value.endsWith(`${firstDigit}${secondDigit}`);
}

function detectPixKey(value: string): { key: string; type: PixKeyType } {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)) {
    return { key: trimmed, type: 'E-mail' };
  }
  if (/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(trimmed)) {
    return { key: trimmed.toLowerCase(), type: 'Chave aleatória' };
  }

  const digits = trimmed.replace(/\D/gu, '');
  const phoneDigits = trimmed.replace(/[\s()+.-]/gu, '');
  const hasInternationalPrefix = trimmed.startsWith('+') || phoneDigits.length > 11;
  if (hasInternationalPrefix && /^55[1-9]\d{9,10}$/u.test(phoneDigits)) {
    const nationalNumber = phoneDigits.startsWith('55') && hasInternationalPrefix
      ? phoneDigits.slice(2)
      : phoneDigits;
    return { key: `+55${nationalNumber}`, type: 'Telefone' };
  }
  if (hasInternationalPrefix) {
    throw new Error('Informe um telefone brasileiro válido com DDD e código +55.');
  }

  if (digits.length === 11 && isValidCpf(digits)) {
    return { key: digits, type: 'CPF' };
  }
  if (digits.length === 11 && /^\d{3}\.\d{3}\.\d{3}-\d{2}$/u.test(trimmed)) {
    throw new Error('Confira os dígitos verificadores do CPF informado.');
  }
  if (digits.length === 14) {
    if (!isValidCnpj(digits)) throw new Error('Confira os dígitos verificadores do CNPJ informado.');
    return { key: digits, type: 'CNPJ' };
  }

  const isNationalPhone = /^[1-9]\d{9,10}$/u.test(digits) &&
    (digits.length === 10 || digits[2] === '9');
  if (isNationalPhone) {
    return { key: `+55${digits}`, type: 'Telefone' };
  }

  if (digits.length === 11) {
    throw new Error('Confira os dígitos do CPF ou do telefone com DDD.');
  }

  throw new Error('Informe uma chave Pix válida: CPF, CNPJ, telefone, e-mail ou chave aleatória.');
}

function normalizeMerchantField(value: string, label: string, maxLength: number): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9 .,&'/-]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!normalized) throw new Error(`Informe ${label}.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  }
  return normalized;
}

export function validatePixChargeConfig(input: PixChargeConfigInput): PixChargeConfig {
  const { key, type } = detectPixKey(input.pixKey);
  return {
    pixKey: key,
    pixKeyType: type,
    merchantName: normalizeMerchantField(input.merchantName, 'o nome do recebedor', 25),
    merchantCity: normalizeMerchantField(input.merchantCity, 'a cidade do recebedor', 15),
  };
}

export async function getPixChargeConfig(): Promise<PixChargeConfig | null> {
  const serialized = await SecureStore.getItemAsync(PIX_CHARGE_CONFIG_KEY);
  if (serialized === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error('A configuração da chave Pix está corrompida.', { cause: error });
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('pixKey' in parsed) ||
    typeof parsed.pixKey !== 'string' ||
    !('merchantName' in parsed) ||
    typeof parsed.merchantName !== 'string' ||
    !('merchantCity' in parsed) ||
    typeof parsed.merchantCity !== 'string'
  ) {
    throw new Error('A configuração salva da chave Pix tem um formato inválido.');
  }

  return validatePixChargeConfig({
    pixKey: parsed.pixKey,
    merchantName: parsed.merchantName,
    merchantCity: parsed.merchantCity,
  });
}

export async function savePixChargeConfig(
  input: PixChargeConfigInput,
): Promise<PixChargeConfig> {
  const config = validatePixChargeConfig(input);
  await SecureStore.setItemAsync(
    PIX_CHARGE_CONFIG_KEY,
    JSON.stringify({
      pixKey: config.pixKey,
      merchantName: config.merchantName,
      merchantCity: config.merchantCity,
    }),
  );
  return config;
}

export function createPixChargePayload(
  config: PixChargeConfig,
  amountInCents: number,
): { brCode: string; amount: number } {
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new Error('Informe um valor de cobrança maior que zero.');
  }

  const amount = amountInCents / 100;
  const pix = createStaticPix({
    pixKey: config.pixKey,
    merchantName: config.merchantName,
    merchantCity: config.merchantCity,
    transactionAmount: amount,
  });
  if (hasError(pix)) {
    throw new Error(`Não foi possível gerar o BR Code Pix: ${pix.error}`);
  }

  const brCode = pix.toBRCode();
  const parsedPix = parsePix(brCode);
  if (
    hasError(parsedPix) ||
    !isStaticPix(parsedPix) ||
    parsedPix.transactionAmount !== amount ||
    parsedPix.pixKey !== config.pixKey
  ) {
    throw new Error('O BR Code gerado não passou na validação de valor e chave Pix.');
  }

  return { brCode, amount };
}
