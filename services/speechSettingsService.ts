import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { NubankNotificationListenerModule } from '@/modules/nubank-notification-listener/src/NubankNotificationListener.types';

const SPEECH_SETTINGS_STORAGE_KEY = '@pixfala/speech-settings';

export const DEFAULT_SPEECH_TEMPLATE = 'Pix recebido de {valor} de {nome} {sobrenome}. Muito obrigado!';
export const SPEECH_RATES = [1, 1.5, 2] as const;

export type SpeechRate = (typeof SPEECH_RATES)[number];

export type SpeechSettings = {
  template: string;
  rate: SpeechRate;
  volume: number;
};

function validateSpeechSettings(value: unknown): SpeechSettings {
  if (typeof value !== 'object' || value === null) {
    throw new Error('As configurações de voz têm um formato inválido.');
  }

  const settings = value as Record<string, unknown>;
  if (
    typeof settings.template !== 'string' ||
    settings.template.trim().length === 0 ||
    settings.template.length > 180
  ) {
    throw new Error('A frase precisa ter entre 1 e 180 caracteres.');
  }
  if (
    typeof settings.rate !== 'number' ||
    (settings.rate !== 1 && settings.rate !== 1.5 && settings.rate !== 2)
  ) {
    throw new Error('Selecione uma velocidade de fala disponível.');
  }
  const volume = settings.volume ?? 1;
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error('O volume da fala deve estar entre 0% e 100%.');
  }
  return { template: settings.template.trim(), rate: settings.rate, volume };
}

async function loadNativeModule(): Promise<NubankNotificationListenerModule> {
  const module = await import('@/modules/nubank-notification-listener/src/NubankNotificationListenerModule');
  return module.default;
}

export async function getSpeechSettings(): Promise<SpeechSettings> {
  if (Platform.OS === 'android') {
    const nativeModule = await loadNativeModule();
    return validateSpeechSettings(nativeModule.getSpeechSettings());
  }

  const serializedSettings = await AsyncStorage.getItem(SPEECH_SETTINGS_STORAGE_KEY);
  if (serializedSettings === null) {
    return { template: DEFAULT_SPEECH_TEMPLATE, rate: 1, volume: 1 };
  }

  let parsedSettings: unknown;
  try {
    parsedSettings = JSON.parse(serializedSettings);
  } catch (error) {
    throw new Error('As configurações de voz estão corrompidas.', { cause: error });
  }
  return validateSpeechSettings(parsedSettings);
}

export async function saveSpeechSettings(settings: SpeechSettings): Promise<SpeechSettings> {
  const validatedSettings = validateSpeechSettings(settings);
  if (Platform.OS === 'android') {
    const nativeModule = await loadNativeModule();
    if (!nativeModule.setSpeechSettings(
      validatedSettings.template,
      validatedSettings.rate,
      validatedSettings.volume,
    )) {
      throw new Error('O Android não confirmou a gravação das configurações de voz.');
    }
    return validatedSettings;
  }

  await AsyncStorage.setItem(
    SPEECH_SETTINGS_STORAGE_KEY,
    JSON.stringify(validatedSettings),
  );
  return validatedSettings;
}
