import { ArrowDownLeft, ArrowUpRight, CalendarDays, TrendingUp } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

const week = [
  { day: 'SEG', height: 34 },
  { day: 'TER', height: 58 },
  { day: 'QUA', height: 44 },
  { day: 'QUI', height: 78 },
  { day: 'SEX', height: 53 },
  { day: 'SÁB', height: 94 },
  { day: 'DOM', height: 25 },
];

const transactions = [
  { name: 'Venda balcão', time: 'Hoje, 14:32', amount: '+ R$ 85,00', icon: ArrowDownLeft },
  { name: 'Pedido #1048', time: 'Hoje, 12:08', amount: '+ R$ 42,50', icon: ArrowDownLeft },
  { name: 'Venda balcão', time: 'Ontem, 18:46', amount: '+ R$ 120,00', icon: ArrowDownLeft },
];

export default function ReportScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <View>
            <Text style={styles.eyebrow}>SEU NEGÓCIO EM NÚMEROS</Text>
            <Text style={styles.title}>Relatório</Text>
          </View>
          <View style={styles.periodButton}>
            <CalendarDays color={theme.colors.secondary} size={15} />
            <Text style={styles.periodText}>7 dias</Text>
          </View>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalTop}>
            <Text style={styles.cardEyebrow}>TOTAL RECEBIDO</Text>
            <View style={styles.trendChip}>
              <TrendingUp color={theme.colors.neon} size={13} />
              <Text style={styles.trendText}>12,8%</Text>
            </View>
          </View>
          <Text style={styles.totalAmount}>R$ 2.840,50</Text>
          <Text style={styles.totalCaption}>em pagamentos Pix nos últimos 7 dias</Text>

          <View style={styles.chart}>
            {week.map((item) => (
              <View key={item.day} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${item.height}%` },
                      item.day === 'SÁB' && styles.barHighlight,
                    ]}
                  />
                </View>
                <Text style={[styles.dayLabel, item.day === 'SÁB' && styles.dayLabelHighlight]}>
                  {item.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <ArrowDownLeft color={theme.colors.neon} size={16} />
            </View>
            <Text style={styles.statLabel}>PIX RECEBIDOS</Text>
            <Text style={styles.statValue}>38</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <ArrowUpRight color="#9B8CFF" size={16} />
            </View>
            <Text style={styles.statLabel}>VALOR MÉDIO</Text>
            <Text style={styles.statValue}>R$ 74,75</Text>
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Atividade recente</Text>
          <Text style={styles.seeAll}>VER TODAS</Text>
        </View>

        <View style={styles.activityCard}>
          {transactions.map((transaction, index) => {
            const Icon = transaction.icon;
            return (
              <View
                key={`${transaction.name}-${transaction.time}`}
                style={[styles.transaction, index > 0 && styles.transactionBorder]}>
                <View style={styles.transactionIcon}>
                  <Icon color={theme.colors.neon} size={17} />
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionName}>{transaction.name}</Text>
                  <Text style={styles.transactionTime}>{transaction.time}</Text>
                </View>
                <Text style={styles.transactionAmount}>{transaction.amount}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.disclaimer}>Dados ilustrativos para visualização do relatório.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28 },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  eyebrow: { color: theme.colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.35 },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.8, marginTop: 5 },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodText: { color: theme.colors.text, fontSize: 11, fontWeight: '600' },
  totalCard: {
    padding: 20,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  totalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: { color: theme.colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10291A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: { color: theme.colors.neon, fontSize: 10, fontWeight: '700' },
  totalAmount: { color: theme.colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -1, marginTop: 15 },
  totalCaption: { color: theme.colors.secondary, fontSize: 11, marginTop: 5 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 124,
    marginTop: 21,
    paddingTop: 4,
  },
  barColumn: { flex: 1, alignItems: 'center', height: '100%' },
  barTrack: { flex: 1, width: 20, justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    minHeight: 9,
    borderRadius: 7,
    backgroundColor: '#28623D',
  },
  barHighlight: { backgroundColor: theme.colors.neon },
  dayLabel: { color: theme.colors.muted, fontSize: 8, fontWeight: '700', marginTop: 8 },
  dayLabelHighlight: { color: theme.colors.neon },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 13 },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    marginBottom: 13,
  },
  statLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  statValue: { color: theme.colors.text, fontSize: 17, fontWeight: '700', marginTop: 5 },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  seeAll: { color: theme.colors.neon, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  activityCard: {
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transaction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  transactionBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10291A',
  },
  transactionCopy: { flex: 1 },
  transactionName: { color: theme.colors.text, fontSize: 11, fontWeight: '600' },
  transactionTime: { color: theme.colors.muted, fontSize: 10, marginTop: 4 },
  transactionAmount: { color: theme.colors.neon, fontSize: 10, fontWeight: '700' },
  disclaimer: { color: theme.colors.muted, fontSize: 10, textAlign: 'center', marginTop: 14 },
});
