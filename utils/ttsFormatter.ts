const smallNumbers = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
];
const teens = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];
const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const hundreds = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

const THANK_YOU_PHRASES = [
  'Muito obrigado.',
  'Obrigado!',
  'Um ótimo dia!',
  'Volte sempre!',
  'Até logo!',
];

function numberUnderThousand(value: number): string {
  if (value < 10) return smallNumbers[value];
  if (value < 20) return teens[value - 10];
  if (value < 100) {
    const remainder = value % 10;
    return remainder === 0 ? tens[Math.floor(value / 10)] : `${tens[Math.floor(value / 10)]} e ${smallNumbers[remainder]}`;
  }
  if (value === 100) return 'cem';

  const remainder = value % 100;
  const prefix = hundreds[Math.floor(value / 100)];
  return remainder === 0 ? prefix : `${prefix} e ${numberUnderThousand(remainder)}`;
}

function numberInWords(value: number): string {
  if (value < 1000) return numberUnderThousand(value);

  const groups = [
    { divisor: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
    { divisor: 1_000_000, singular: 'milhão', plural: 'milhões' },
    { divisor: 1000, singular: 'mil', plural: 'mil' },
    { divisor: 1, singular: '', plural: '' },
  ];
  let remainder = value;
  const parts: string[] = [];

  for (const group of groups) {
    const quantity = Math.floor(remainder / group.divisor);
    if (quantity === 0) continue;

    remainder %= group.divisor;
    const quantityWords = group.divisor === 1000 && quantity === 1 ? '' : numberUnderThousand(quantity);
    const scaleName =
      group.divisor === 1
        ? ''
        : quantity === 1
          ? group.singular
          : group.plural;
    parts.push([quantityWords, scaleName].filter(Boolean).join(' '));
  }

  return parts.join(' e ');
}

export function formatarNomeParaVoz(nome?: string): string | null {
  const nomes = nome?.trim().split(/\s+/u).filter(Boolean).slice(0, 2);
  return nomes?.length ? nomes.join(' ') : null;
}

export function formatarValorPorExtenso(valorFormatado: string): string {
  const [integerText, centsText = '00'] = valorFormatado.split(',');
  const reais = Number(integerText.replace(/\./gu, ''));
  const centavos = Number(centsText);
  const spokenParts: string[] = [];

  if (reais > 0) {
    const reaisWords = numberInWords(reais);
    spokenParts.push(`${reaisWords} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) {
    const centavosWords = numberInWords(centavos);
    spokenParts.push(`${centavosWords} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }

  return spokenParts.join(' e ');
}

export function escolherFraseDeAgradecimento(): string {
  const phraseIndex = Math.floor(Math.random() * THANK_YOU_PHRASES.length);
  return THANK_YOU_PHRASES[phraseIndex];
}
