import AsyncStorage from '@react-native-async-storage/async-storage';

import { banks, isBankSelectionId } from '@/constants/banks';

const BANK_SELECTION_STORAGE_KEY = '@pixfala/selected-bank';
const DEFAULT_BANK_ID = 'nubank';

export async function getSelectedBankId(): Promise<string> {
  const storedSelection = await AsyncStorage.getItem(BANK_SELECTION_STORAGE_KEY);
  if (storedSelection === null) {
    await AsyncStorage.setItem(BANK_SELECTION_STORAGE_KEY, DEFAULT_BANK_ID);
    return DEFAULT_BANK_ID;
  }
  if (!isBankSelectionId(storedSelection)) {
    throw new Error('O banco salvo não é reconhecido. Selecione novamente o banco para Pix.');
  }

  return storedSelection;
}

export async function saveSelectedBankId(bankId: string): Promise<void> {
  if (!isBankSelectionId(bankId)) {
    throw new Error('Não é possível salvar um banco não suportado.');
  }

  await AsyncStorage.setItem(BANK_SELECTION_STORAGE_KEY, bankId);
}
