const MONEY_PATTERN = /(?:^|[^\d.,])((?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)(?![\d.,])/iu;
const PAYER_NAME_CHARACTERS = /[^\p{L}\p{M}\s.'’-]/gu;

export function formatarValorMonetario(entrada: string): string | null {
  const valor = entrada.trim().replace(/^R\$\s*/iu, '').replace(/\s/gu, '');
  if (!valor) return null;

  let parteInteira: string;
  let parteDecimal: string;

  if (valor.includes(',')) {
    const partes = valor.split(',');
    if (partes.length !== 2 || !/^\d{1,2}$/u.test(partes[1])) return null;

    parteInteira = partes[0].replace(/\./gu, '');
    parteDecimal = partes[1].padEnd(2, '0');
    if (!/^\d{1,3}(?:\.\d{3})*$|^\d+$/u.test(partes[0])) return null;
  } else if (/^\d{1,3}(?:\.\d{3})+$/u.test(valor)) {
    parteInteira = valor.replace(/\./gu, '');
    parteDecimal = '00';
  } else if (/^\d+(?:\.\d{1,2})?$/u.test(valor)) {
    const [inteiro, decimal = ''] = valor.split('.');
    parteInteira = inteiro;
    parteDecimal = decimal.padEnd(2, '0');
  } else {
    return null;
  }

  const inteiroNormalizado = parteInteira.replace(/^0+(?=\d)/u, '');
  if (inteiroNormalizado.length > 12) return null;

  const centavos = Number(`${inteiroNormalizado}.${parteDecimal}`);
  if (!Number.isFinite(centavos) || centavos <= 0) return null;

  const inteiroFormatado = inteiroNormalizado.replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
  return `${inteiroFormatado},${parteDecimal}`;
}

export function extrairValorMonetario(texto: string): string | null {
  const correspondencia = texto.match(MONEY_PATTERN);
  return correspondencia ? formatarValorMonetario(correspondencia[1]) : null;
}

export function formatarNomePagador(nome: string): string | null {
  const nomeNormalizado = nome
    .replace(PAYER_NAME_CHARACTERS, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 60);

  return nomeNormalizado.length > 0 ? nomeNormalizado : null;
}

export function extrairNomePagador(texto: string): string | null {
  const nomeInformado = texto.match(
    /(?:pagador(?:a)?|nome)\s*[:=-]\s*([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,58}?)(?=\s+(?:no\s+valor|valor|enviou|pagou|às|em)\b|[,.!?;]|$)/iu,
  );
  const nomeDoPix = texto.match(
    /\bde\s+([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,58}?)(?=\s+(?:no\s+valor|valor|enviou|pagou|às|em)\b|[,.!?;]|$)/iu,
  );
  const nome = nomeInformado?.[1] ?? nomeDoPix?.[1];

  return nome ? formatarNomePagador(nome) : null;
}
