import AsyncStorage from '@react-native-async-storage/async-storage';

const PIX_RECORDS_STORAGE_KEY = '@pixfala/pix-records';
const PIX_RECORDS_RETENTION_MONTHS = 12;

export type PixRecord = {
  id: string;
  valor: string;
  nomePagador: string;
  banco: string;
  timestamp: string;
  packageName?: string;
  rawNotificationText?: string;
};

type PixRecordsListener = (records: PixRecord[]) => void;

const listeners = new Set<PixRecordsListener>();
let writeQueue = Promise.resolve();

function isPixRecord(value: unknown): value is PixRecord {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.valor === 'string' &&
    typeof record.nomePagador === 'string' &&
    typeof record.banco === 'string' &&
    typeof record.timestamp === 'string' &&
    (record.packageName === undefined || typeof record.packageName === 'string') &&
    (record.rawNotificationText === undefined || typeof record.rawNotificationText === 'string') &&
    Number.isFinite(Date.parse(record.timestamp))
  );
}

async function readRecords(): Promise<PixRecord[]> {
  const serializedRecords = await AsyncStorage.getItem(PIX_RECORDS_STORAGE_KEY);
  if (serializedRecords === null) return [];

  let parsedRecords: unknown;
  try {
    parsedRecords = JSON.parse(serializedRecords);
  } catch (error) {
    throw new Error('O histórico de Pix está corrompido e não pode ser lido.', { cause: error });
  }

  if (!Array.isArray(parsedRecords) || !parsedRecords.every(isPixRecord)) {
    throw new Error('O histórico de Pix tem um formato inválido e não pode ser lido.');
  }

  return parsedRecords;
}

function getRetentionCutoff(now = new Date()): Date {
  const cutoffYear = now.getFullYear() - PIX_RECORDS_RETENTION_MONTHS / 12;
  const lastDayOfCutoffMonth = new Date(cutoffYear, now.getMonth() + 1, 0).getDate();

  return new Date(
    cutoffYear,
    now.getMonth(),
    Math.min(now.getDate(), lastDayOfCutoffMonth),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
}

function removeExpiredRecords(records: PixRecord[], now = new Date()): PixRecord[] {
  const cutoff = getRetentionCutoff(now).getTime();
  return records.filter((record) => Date.parse(record.timestamp) >= cutoff);
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function notifyListeners(records: PixRecord[]): void {
  for (const listener of listeners) listener(records);
}

export function getPixRecords(): Promise<PixRecord[]> {
  return enqueueWrite(async () => {
    const records = await readRecords();
    const retainedRecords = removeExpiredRecords(records);
    if (retainedRecords.length !== records.length) {
      await AsyncStorage.setItem(PIX_RECORDS_STORAGE_KEY, JSON.stringify(retainedRecords));
      notifyListeners(retainedRecords);
    }
    return retainedRecords;
  });
}

export function savePixRecord(
  record: Omit<PixRecord, 'id'> & { id?: string },
): Promise<PixRecord> {
  return enqueueWrite(async () => {
    const records = await readRecords();
    const savedRecord: PixRecord = {
      ...record,
      id: record.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    };
    const updatedRecords = removeExpiredRecords([
      savedRecord,
      ...records.filter((existingRecord) => existingRecord.id !== savedRecord.id),
    ]);
    await AsyncStorage.setItem(PIX_RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    notifyListeners(updatedRecords);
    return savedRecord;
  });
}

export function clearTodayPixRecords(now = new Date()): Promise<PixRecord[]> {
  return enqueueWrite(async () => {
    const records = await readRecords();
    const retainedRecords = removeExpiredRecords(records, now);
    const updatedRecords = retainedRecords.filter((record) => {
      const timestamp = new Date(record.timestamp);
      return (
        timestamp.getFullYear() !== now.getFullYear() ||
        timestamp.getMonth() !== now.getMonth() ||
        timestamp.getDate() !== now.getDate()
      );
    });
    await AsyncStorage.setItem(PIX_RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    notifyListeners(updatedRecords);
    return updatedRecords;
  });
}

export function subscribeToPixRecords(listener: PixRecordsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
