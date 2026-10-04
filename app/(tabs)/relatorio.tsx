import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, Clock3, RefreshCw, Trash2 } from 'lucide-react-native';

import { theme } from '@/constants/theme';
import {
  clearTodayPixRecords,
  getPixRecords,
  subscribeToPixRecords,
  type PixRecord,
} from '@/services/pixStorage';
import { formatarValorMonetario } from '@/utils/pixFormatter';

function isToday(timestamp: string, now = new Date()): boolean {
  const date = new Date(timestamp);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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

function filterToday(records: PixRecord[]): PixRecord[] {
  return records
    .filter((record) => isToday(record.timestamp))
    .sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
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

  const todayRecords = useMemo(() => filterToday(records), [records]);
  const totalCents = useMemo(
    () => todayRecords.reduce((total, record) => total + amountInCents(record.valor), 0),
    [todayRecords],
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
        data={todayRecords}
        keyExtractor={(record) => record.id}
        renderItem={({ item, index }) => (
          <PixRow record={item} last={index === todayRecords.length - 1} />
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
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.cardEyebrow}>TOTAL DO DIA</Text>
              <Text style={styles.totalAmount}>{formatCurrency(totalCents)}</Text>
              <Text style={styles.totalCaption}>
                {todayRecords.length === 1
                  ? '1 Pix recebido hoje'
                  : `${todayRecords.length} Pix recebidos hoje`}
              </Text>
              <View style={styles.totalGlow} />
            </View>

            <View style={styles.listHeading}>
              <View>
                <Text style={styles.sectionTitle}>Pix de hoje</Text>
                <Text style={styles.sectionCaption}>Atualizado conforme os recebimentos chegam</Text>
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
              <Text style={styles.emptyTitle}>Nenhum Pix por aqui ainda</Text>
              <Text style={styles.emptyDescription}>
                Seus recebimentos anunciados aparecerão neste relatório.
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
