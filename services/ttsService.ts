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

  const voiceName = formatarNomeParaVoz(nomePagador ?? undefined);
  const amountInWords = valorFormatado ? formatarValorPorExtenso(valorFormatado) : 'valor não informado';
  const thankYou = escolherFraseDeAgradecimento();
  const text = `Olá! Pix recebido no valor de ${amountInWords}${
    voiceName ? ` de ${voiceName}` : ''
  }. ${thankYou}!`;

  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: 'pt-BR',
      rate: 0.92,
      onDone: resolve,
      onStopped: () => reject(new Error('O anúncio de voz foi interrompido.')),
      onError: reject,
    });
  });
}
