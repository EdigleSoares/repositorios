import * as Speech from 'expo-speech';

import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';
import {
  escolherFraseDeAgradecimento,
  formatarNomeParaVoz,
  formatarValorPorExtenso,
} from '@/utils/ttsFormatter';

type SpeechQueueItem = {
  text: string;
  resolve: () => void;
  reject: (error: Error) => void;
};

const speechQueue: SpeechQueueItem[] = [];
let isSpeaking = false;

function processarFila(): void {
  if (isSpeaking) return;

  const nextSpeech = speechQueue.shift();
  if (!nextSpeech) return;

  isSpeaking = true;
  let settled = false;

  const finishSpeech = (error?: Error) => {
    if (settled) return;
    settled = true;
    isSpeaking = false;

    if (error) {
      nextSpeech.reject(error);
    } else {
      nextSpeech.resolve();
    }

    processarFila();
  };

  try {
    Speech.speak(nextSpeech.text, {
      language: 'pt-BR',
      rate: 0.92,
      onStart: () => console.log('[PixFala][tts] Expo Speech iniciou o anúncio.'),
      onDone: () => {
        console.log('[PixFala][tts] Expo Speech concluiu o anúncio.');
        finishSpeech();
      },
      onStopped: () => {
        console.warn('[PixFala][tts] Expo Speech foi interrompido.');
        finishSpeech(new Error('O anúncio de voz foi interrompido.'));
      },
      onError: (error) => {
        console.error('[PixFala][tts] Expo Speech reportou falha.', error);
        finishSpeech(error);
      },
    });
  } catch (error) {
    finishSpeech(
      error instanceof Error ? error : new Error('Não foi possível iniciar o anúncio de voz.'),
    );
  }
}

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
  const text = `Pix recebido de ${amountInWords} de ${voiceName ?? 'Cliente'}. ${thankYou}`;

  return new Promise<void>((resolve, reject) => {
    speechQueue.push({
      text,
      resolve,
      reject: (error) => reject(error),
    });
    processarFila();
  });
}
