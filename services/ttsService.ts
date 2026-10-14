import * as Speech from 'expo-speech';

import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';
import {
  formatarNomeParaVoz,
  formatarSobrenomeParaVoz,
  formatarValorPorExtenso,
} from '@/utils/ttsFormatter';
import {
  getSpeechSettings,
  type SpeechRate,
} from '@/services/speechSettingsService';

type SpeechQueueItem = {
  text: string;
  rate: SpeechRate;
  resolve: () => void;
  reject: (error: Error) => void;
};

const speechQueue: SpeechQueueItem[] = [];
let isSpeaking = false;

function enfileirarFala(text: string, rate: SpeechRate): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    speechQueue.push({ text, rate, resolve, reject });
    processarFila();
  });
}

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
      rate: nextSpeech.rate,
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

  const amountInWords = valorFormatado ? formatarValorPorExtenso(valorFormatado) : 'valor não informado';
  return getSpeechSettings().then((settings) => {
    const voiceName = formatarNomeParaVoz(nomePagador ?? undefined) ?? 'Cliente';
    const voiceSurname = formatarSobrenomeParaVoz(nomePagador ?? undefined) ?? '';
    const text = settings.template
      .replace(/\{valor\}/giu, amountInWords)
      .replace(/\{nome\}/giu, voiceName)
      .replace(/\{sobrenome\}/giu, voiceSurname);
    return enfileirarFala(text, settings.rate);
  });
}

export function testarMensagemVoz(
  template: string,
  rate: SpeechRate,
): Promise<void> {
  if (!template.trim() || template.length > 180) {
    throw new Error('A frase precisa ter entre 1 e 180 caracteres.');
  }
  if (rate !== 1 && rate !== 1.5 && rate !== 2) {
    throw new Error('Selecione uma velocidade de fala disponível.');
  }
  const sampleText = template
    .trim()
    .replace(/\{valor\}/giu, 'dois reais e cinquenta centavos')
    .replace(/\{nome\}/giu, 'Maria')
    .replace(/\{sobrenome\}/giu, 'Silva');
  return enfileirarFala(sampleText, rate);
}
