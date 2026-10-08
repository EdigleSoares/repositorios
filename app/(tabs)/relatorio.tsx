import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, Clock3, RefreshCw, Search, Trash2, X } from 'lucide-react-native';

import { theme } from '@/constants/theme';
import {
  clearTodayPixRecords,
  getPixRecords,
  subscribeToPixRecords,
  type PixRecord,
} from '@/services/pixStorage';
import { formatarValorMonetario } from '@/utils/pixFormatter';

type ReportPeriod = 'today' | 'week' | 'month';

const REPORT_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
];

const PERIOD_LABELS: Record<ReportPeriod, { total: string; list: string; caption: string }> = {
  today: { total: 'TOTAL DE HOJE', list: 'Pix de hoje', caption: 'hoje' },
  week: { total: 'TOTAL DA SEMANA', list: 'Pix desta semana', caption: 'nesta semana' },
  month: { total: 'TOTAL DO MÊS', list: 'Pix deste mês', caption: 'neste mês' },
};

function getPeriodRange(period: ReportPeriod, now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === 'month') {
    start.setDate(1);
  }

  const end = new Date(start);
  if (period === 'week') {
    end.setDate(end.getDate() + 7);
  } else if (period === 'month') {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

function amountInCents(value: string): number {
  const formatted = formatarValorMonetario(value);
  if (!formatted) return 0;
  return Math.round(Number(formatted.replace(/\./gu, '').replace(',', '.')) * 100);
}

function formatCurrency(cents: number): string {
  const amount = (cents / 100).toFixed(2).replace('.', ',');
  return `R$ ${amount.replace(/\B(?=(\d{3})+(?!\d))/gu, '.')}`;
}

function formatRecordValue(value: string): string {
  const cents = amountInCents(value);
  return cents > 0 ? formatCurrency(cents) : value;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '--:--';

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function filterPeriod(
  records: PixRecord[],
  period: ReportPeriod,
  now = new Date(),
): PixRecord[] {
  const { start, end } = getPeriodRange(period, now);
  return records
    .filter((record) => {
      const timestamp = Date.parse(record.timestamp);
      return timestamp >= start.getTime() && timestamp < end.getTime();
    })
    .sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function matchesSearch(record: PixRecord, query: string): boolean {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const normalizedPayer = normalizeSearch(record.nomePagador);
  if (normalizedPayer.includes(normalizedQuery)) return true;

  const queryDigits = normalizedQuery.replace(/\D/gu, '');
  if (!queryDigits) return false;

  const storedValueDigits = record.valor.replace(/\D/gu, '');
  const formattedValueDigits = formatRecordValue(record.valor).replace(/\D/gu, '');
  return storedValueDigits.includes(queryDigits) || formattedValueDigits.includes(queryDigits);
}

function formatWeekRange(now: Date): string {
  const { start, end } = getPeriodRange('week', now);
  end.setDate(end.getDate() - 1);
  const format = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${format(start)} – ${format(end)}`;
}

function PixRow({ record, last }: { record: PixRecord; last: boolean }) {
  return (
    <View style={[styles.pixRow, !last && styles.pixRowBorder]}>
      <View style={styles.pixIcon}>
        <ArrowDownLeft color={theme.colors.neon} size={18} strokeWidth={2} />
      </View>
      <View style={styles.pixCopy}>
        <Text style={styles.payer} numberOfLines={1}>{record.nomePagador}</Text>
        <Text style={styles.bank} numberOfLines={1}>{record.banco}</Text>
      </View>
      <View style={styles.pixAmountCopy}>
        <Text style={styles.amount}>{formatRecordValue(record.valor)}</Text>
        <View style={styles.timeRow}>
          <Clock3 color={theme.colors.muted} size={11} />
          <Text style={styles.time}>{formatTime(record.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const [records, setRecords] = useState<PixRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => new Date());

  const periodRecords = useMemo(
    () => filterPeriod(records, period, now),
    [now, period, records],
  );
  const visibleRecords = useMemo(
    () => periodRecords.filter((record) => matchesSearch(record, searchQuery)),
    [periodRecords, searchQuery],
  );
  const todayRecords = useMemo(() => filterPeriod(records, 'today', now), [now, records]);
  const totalCents = useMemo(
    () => periodRecords.reduce((total, record) => total + amountInCents(record.valor), 0),
    [periodRecords],
  );

  const refreshRecords = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRecords(await getPixRecords());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o histórico de Pix.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let updateCount = 0;
    const unsubscribe = subscribeToPixRecords((updatedRecords) => {
      updateCount += 1;
      if (mounted) {
        setRecords(updatedRecords);
        setError(undefined);
      }
    });
    const startingUpdateCount = updateCount;

    void getPixRecords()
      .then((storedRecords) => {
        if (mounted && updateCount === startingUpdateCount) setRecords(storedRecords);
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar o histórico de Pix.',
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refreshPeriodDate = () => setNow(new Date());
    const interval = setInterval(refreshPeriodDate, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPeriodDate();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  const confirmClearToday = () => {
    Alert.alert(
      'Limpar histórico de hoje?',
      'Os Pix recebidos hoje serão removidos. Os registros de outros dias serão mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => {
            void clearTodayPixRecords()
              .then(setRecords)
              .catch((clearError: unknown) => {
                const message =
                  clearError instanceof Error
                    ? clearError.message
                    : 'Não foi possível limpar o histórico de hoje.';
                Alert.alert('Erro ao limpar histórico', message);
              });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={visibleRecords}
        keyExtractor={(record) => record.id}
        renderItem={({ item, index }) => (
          <PixRow record={item} last={index === visibleRecords.length - 1} />
        )}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.topLine}>
              <View>
                <Text style={styles.eyebrow}>SEU NEGÓCIO EM NÚMEROS</Text>
                <Text style={styles.title}>Relatório</Text>
              </View>
              {period === 'today' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Limpar histórico de hoje"
                  onPress={confirmClearToday}
                  disabled={todayRecords.length === 0}
                  style={({ pressed }) => [
                    styles.clearButton,
                    todayRecords.length === 0 && styles.disabledButton,
                    pressed && todayRecords.length > 0 && styles.pressed,
                  ]}>
                  <Trash2 color={todayRecords.length > 0 ? '#FF8585' : theme.colors.muted} size={16} />
                  <Text style={[styles.clearLabel, todayRecords.length === 0 && styles.disabledLabel]}>
                    Limpar hoje
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.periodSelector}>
              {REPORT_PERIODS.map((item) => {
                const selected = period === item.key;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setPeriod(item.key)}
                    style={({ pressed }) => [
                      styles.periodButton,
                      selected && styles.periodButtonSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.periodButtonText, selected && styles.periodButtonTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.cardEyebrow}>{PERIOD_LABELS[period].total}</Text>
              <Text style={styles.totalAmount}>{formatCurrency(totalCents)}</Text>
              <Text style={styles.totalCaption}>
                {`${periodRecords.length} Pix ${periodRecords.length === 1 ? 'recebido' : 'recebidos'} ${PERIOD_LABELS[period].caption}`}
              </Text>
              <View style={styles.totalGlow} />
            </View>

            <View style={styles.searchBox}>
              <Search color={theme.colors.muted} size={17} />
              <TextInput
                accessibilityLabel="Pesquisar Pix por nome ou valor"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por nome ou valor"
                placeholderTextColor={theme.colors.muted}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Limpar pesquisa"
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}>
                  <X color={theme.colors.secondary} size={17} />
                </Pressable>
              )}
            </View>

            <View style={styles.listHeading}>
              <View>
                <Text style={styles.sectionTitle}>{PERIOD_LABELS[period].list}</Text>
                <Text style={styles.sectionCaption}>
                  {period === 'week'
                    ? formatWeekRange(now)
                    : period === 'month'
                        ? now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                      : 'Atualizado conforme os recebimentos chegam'}
                </Text>
              </View>
              {loading && <ActivityIndicator color={theme.colors.neon} size="small" />}
            </View>
            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={() => void refreshRecords()}>
                  <RefreshCw color={theme.colors.neon} size={18} />
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <ArrowDownLeft color={theme.colors.neon} size={22} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhum Pix neste período'}
              </Text>
              <Text style={styles.emptyDescription}>
                {searchQuery
                  ? 'Tente pesquisar por outro nome ou valor.'
                  : 'Seus recebimentos aparecerão aqui conforme forem registrados.'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28, flexGrow: 1 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  eyebrow: { color: theme.colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.35 },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.8, marginTop: 5 },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: '#25191B',
    borderWidth: 1,
    borderColor: '#492A2D',
  },
  disabledButton: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  clearLabel: { color: '#FF8585', fontSize: 10, fontWeight: '700' },
  disabledLabel: { color: theme.colors.muted },
  pressed: { opacity: 0.78 },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    padding: 5,
    marginBottom: 15,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  periodButtonSelected: { backgroundColor: '#183222' },
  periodButtonText: { color: theme.colors.secondary, fontSize: 12, fontWeight: '600' },
  periodButtonTextSelected: { color: theme.colors.neon, fontWeight: '700' },
  totalCard: {
    overflow: 'hidden',
    padding: 20,
    borderRadius: theme.radius.card,
    backgroundColor: '#151E19',
    borderWidth: 1,
    borderColor: '#275137',
  },
  cardEyebrow: { color: '#A7B1AA', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  totalAmount: { color: theme.colors.neon, fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 14 },
  totalCaption: { color: '#A7B1AA', fontSize: 11, marginTop: 5 },
  totalGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -85,
    right: -45,
    backgroundColor: '#1C3D29',
    opacity: 0.45,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    marginTop: 14,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 12, paddingVertical: 0 },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  sectionCaption: { color: theme.colors.muted, fontSize: 10, marginTop: 4 },
  pixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
  },
  pixRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pixIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10291A',
  },
  pixCopy: { flex: 1 },
  payer: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  bank: { color: theme.colors.secondary, fontSize: 10, marginTop: 4 },
  pixAmountCopy: { alignItems: 'flex-end' },
  amount: { color: theme.colors.neon, fontSize: 12, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  time: { color: theme.colors.muted, fontSize: 10 },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 19,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#10291A',
  },
  emptyTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginTop: 13 },
  emptyDescription: { color: theme.colors.secondary, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 6 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#25191B',
    borderWidth: 1,
    borderColor: '#492A2D',
  },
  errorText: { flex: 1, color: '#FF9A9A', fontSize: 11, lineHeight: 16 },
});
