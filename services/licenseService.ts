import AsyncStorage from '@react-native-async-storage/async-storage';

const LICENSE_STATUS_KEY = 'isActivated';
const MASTER_LICENSE_KEY = '159632ME';

export async function isLicenseActivated(): Promise<boolean> {
  return (await AsyncStorage.getItem(LICENSE_STATUS_KEY)) === 'true';
}

export async function activateLicense(licenseKey: string): Promise<boolean> {
  if (licenseKey.trim() !== MASTER_LICENSE_KEY) return false;

  await AsyncStorage.setItem(LICENSE_STATUS_KEY, 'true');
  return true;
}
