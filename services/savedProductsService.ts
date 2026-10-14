import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_PRODUCTS_STORAGE_KEY = '@pixfala/saved-products';

export type SavedProduct = {
  id: string;
  name: string;
  priceInCents: number;
};

let writeQueue = Promise.resolve();

function validateProducts(value: unknown): SavedProduct[] {
  if (!Array.isArray(value)) {
    throw new Error('A lista de produtos salva tem um formato inválido.');
  }
  if (!value.every((item) => (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    'name' in item &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.name.length <= 50 &&
    'priceInCents' in item &&
    typeof item.priceInCents === 'number' &&
    Number.isSafeInteger(item.priceInCents) &&
    item.priceInCents > 0
  ))) {
    throw new Error('Um ou mais produtos salvos têm dados inválidos.');
  }

  return value.map((item) => ({
    id: item.id,
    name: item.name.trim(),
    priceInCents: item.priceInCents,
  }));
}

async function readProducts(): Promise<SavedProduct[]> {
  const serializedProducts = await AsyncStorage.getItem(SAVED_PRODUCTS_STORAGE_KEY);
  if (serializedProducts === null) return [];

  let parsedProducts: unknown;
  try {
    parsedProducts = JSON.parse(serializedProducts);
  } catch (error) {
    throw new Error('A lista de produtos está corrompida.', { cause: error });
  }
  return validateProducts(parsedProducts);
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function getSavedProducts(): Promise<SavedProduct[]> {
  return enqueueWrite(readProducts);
}

export function saveProduct(product: SavedProduct): Promise<SavedProduct[]> {
  return enqueueWrite(async () => {
    const products = await readProducts();
    const updatedProducts = validateProducts([
      product,
      ...products.filter((savedProduct) => savedProduct.id !== product.id),
    ]);
    await AsyncStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  });
}

export function deleteSavedProduct(productId: string): Promise<SavedProduct[]> {
  return enqueueWrite(async () => {
    const products = await readProducts();
    const updatedProducts = products.filter((product) => product.id !== productId);
    await AsyncStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify(updatedProducts));
    return updatedProducts;
  });
}
