import * as Speech from 'expo-speech';

import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';
import {
  escolherFraseDeAgradecimento,
  formatarNomeParaVoz,
  formatarValorPorExtenso,
} from '@/utils/ttsFormatter';

export function falarPix(valor?: string, pagador?: string): Promise<void> {
  const valorFormatado = valor === undefined ? null : formatarValorMonetario(valor);
  if (valor !== undefined && !valorFormatado) {
    throw new Error('Informe um valor de Pix válido e maior que zero.');
  }

  const nomePagador = pagador === undefined ? null : formatarNomePagador(pagador);
  if (pagador !== undefined && !nomePagador) {
    throw new Error('Informe um nome de pagador válido.');
  }

  const valorFalado = valorFormatado ? formatarValorPorExtenso(valorFormatado) : '';
  const nomeParaVoz = formatarNomeParaVoz(nomePagador ?? undefined);
  const agradecimento = escolherFraseDeAgradecimento();
  const texto = `Pix recebido:${valorFalado ? ` ${valorFalado}.` : ''} ${agradecimento}${
    nomeParaVoz ? `, ${nomeParaVoz}` : ''
  }!`;

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
