import * as Speech from 'expo-speech';

import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';

export function falarPix(valor: string, pagador?: string): Promise<void> {
  const valorFormatado = formatarValorMonetario(valor);
  if (!valorFormatado) {
    throw new Error('Informe um valor de Pix válido e maior que zero.');
  }

  const [reaisTexto, centavosTexto] = valorFormatado.split(',');
  const reais = Number(reaisTexto.replace(/\./gu, ''));
  const centavos = Number(centavosTexto);
  const valorFalado =
    reais === 0
      ? `${centavos} ${centavos === 1 ? 'centavo' : 'centavos'}`
      : `${reais} ${reais === 1 ? 'real' : 'reais'}${
          centavos > 0 ? ` e ${centavos} ${centavos === 1 ? 'centavo' : 'centavos'}` : ''
        }`;

  const nomePagador = pagador === undefined ? null : formatarNomePagador(pagador);
  if (pagador !== undefined && !nomePagador) {
    throw new Error('Informe um nome de pagador válido.');
  }

  const texto = `Pix recebido! ${valorFalado}${nomePagador ? ` de ${nomePagador}` : ''}.`;

  return new Promise((resolve, reject) => {
    Speech.speak(texto, {
      language: 'pt-BR',
      rate: 0.92,
      onDone: resolve,
      onStopped: () => reject(new Error('O anúncio de voz foi interrompido.')),
      onError: reject,
    });
  });
}
