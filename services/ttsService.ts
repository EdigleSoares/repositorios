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
  volume: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

const speechQueue: SpeechQueueItem[] = [];
let isSpeaking = false;

function enfileirarFala(text: string, rate: SpeechRate, volume: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    speechQueue.push({ text, rate, volume, resolve, reject });
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
      volume: nextSpeech.volume,
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

function preencherModelo(template: string, replacements: Record<string, string>): string {
  const populatedTemplate = Object.entries(replacements).reduce(
    (text, [variable, value]) => text.replace(new RegExp(`\\{${variable}\\}`, 'giu'), value),
    template,
  );
  return populatedTemplate
    .replace(/\s+([.,!?;:])/gu, '$1')
    .replace(/\s{2,}/gu, ' ')
    .trim();
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
    const text = preencherModelo(settings.template, {
      valor: amountInWords,
      nome: formatarNomeParaVoz(nomePagador ?? undefined) ?? 'Cliente',
      sobrenome: formatarSobrenomeParaVoz(nomePagador ?? undefined) ?? '',
    });
    return enfileirarFala(text, settings.rate, settings.volume);
  });
}

export function testarMensagemVoz(
  template: string,
  rate: SpeechRate,
  volume: number,
): Promise<void> {
  if (!template.trim() || template.length > 180) {
    throw new Error('A frase precisa ter entre 1 e 180 caracteres.');
  }
  if (rate !== 1 && rate !== 1.5 && rate !== 2) {
    throw new Error('Selecione uma velocidade de fala disponível.');
  }
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error('O volume da fala deve estar entre 0% e 100%.');
  }
  const sampleText = preencherModelo(template.trim(), {
    valor: 'dois reais e cinquenta centavos',
    nome: 'Maria',
    sobrenome: 'Silva',
  });
  return enfileirarFala(sampleText, rate, volume);
}
