import AsyncStorage from '@react-native-async-storage/async-storage';

import { ALL_BANKS_ID, banks, isBankSelectionId } from '@/constants/banks';

export const STORAGE_KEY_SELECTED_BANK = '@pixfala_selected_package';
export const DEFAULT_SELECTED_BANK_PACKAGE = 'com.nu.production';
const LEGACY_BANK_SELECTION_STORAGE_KEY = '@pixfala/selected-bank';

export async function getSelectedBankPackage(): Promise<string> {
  const storedPackage = await AsyncStorage.getItem(STORAGE_KEY_SELECTED_BANK);
  if (storedPackage !== null) {
    if (!isBankSelectionId(storedPackage)) {
      throw new Error('O pacote salvo para o banco não é reconhecido. Selecione novamente o banco para Pix.');
    }
    return storedPackage;
  }

  const legacySelection = await AsyncStorage.getItem(LEGACY_BANK_SELECTION_STORAGE_KEY);
  let initialPackage = DEFAULT_SELECTED_BANK_PACKAGE;
  if (legacySelection === ALL_BANKS_ID || legacySelection === 'all') {
    initialPackage = ALL_BANKS_ID;
  } else if (legacySelection !== null) {
    const legacyBank = banks.find((bank) => bank.id === legacySelection);
    if (legacyBank?.packageNames[0]) initialPackage = legacyBank.packageNames[0];
  }

  await AsyncStorage.setItem(STORAGE_KEY_SELECTED_BANK, initialPackage);
  return initialPackage;
}

export async function saveSelectedBankPackage(packageName: string): Promise<void> {
  if (!isBankSelectionId(packageName)) {
    throw new Error('Não é possível salvar um pacote de banco não suportado.');
  }

  await AsyncStorage.setItem(STORAGE_KEY_SELECTED_BANK, packageName);
}
