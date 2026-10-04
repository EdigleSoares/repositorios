import { BadgeCheck, ChartNoAxesCombined, Rocket, Sparkles, Zap } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

const benefits = [
  {
    icon: Zap,
    title: 'Pix anunciado na hora',
    description: 'Confirme cada pagamento sem tirar os olhos do atendimento.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Mais controle das vendas',
    description: 'Acompanhe sua movimentação em um só lugar.',
  },
  {
    icon: BadgeCheck,
    title: 'Mais tranquilidade',
    description: 'Atenda com confiança enquanto o PixFala cuida dos avisos.',
  },
];

export default function BusinessScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>PIX FALA, NEGÓCIO CRESCE</Text>
        <Text style={styles.title}>Turbine seu negócio</Text>
        <Text style={styles.subtitle}>
          Mais praticidade no seu dia a dia. Você cuida das vendas, o PixFala avisa quando o pagamento chegar.
        </Text>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopline}>
            <View style={styles.heroIcon}>
              <Rocket color={theme.colors.neon} size={25} strokeWidth={2} />
            </View>
            <View style={styles.recommended}>
              <Sparkles color={theme.colors.neon} size={12} />
              <Text style={styles.recommendedText}>FEITO PARA VOCÊ</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Seu próximo nível começa com mais tempo.</Text>
          <Text style={styles.heroCopy}>
            Uma rotina mais leve para você focar no que faz seu negócio acontecer.
          </Text>
          <View style={styles.heroFoot}>
            <View style={styles.heroLine} />
            <Text style={styles.heroFootText}>SIMPLES. RÁPIDO. PIXFALA.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Feito para a sua rotina</Text>
        <View style={styles.benefits}>
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <View
                key={benefit.title}
                style={[styles.benefit, index > 0 && styles.benefitBorder]}>
                <View style={styles.benefitIcon}>
                  <Icon color={theme.colors.neon} size={18} strokeWidth={1.9} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>{benefit.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footerCard}>
          <View style={styles.footerMark}>
            <Zap color={theme.colors.neon} size={16} />
          </View>
          <Text style={styles.footerText}>Pequenas facilidades. Grandes diferenças no seu dia.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 22, paddingTop: 23, paddingBottom: 28 },
  eyebrow: { color: theme.colors.neon, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.8, marginTop: 7 },
  subtitle: { color: theme.colors.secondary, fontSize: 12, lineHeight: 19, marginTop: 9, marginBottom: 21 },
  hero: {
    overflow: 'hidden',
    padding: 21,
    borderRadius: theme.radius.card,
    backgroundColor: '#151E19',
    borderWidth: 1,
    borderColor: '#275137',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -90,
    right: -60,
    backgroundColor: '#1C3D29',
    opacity: 0.52,
  },
  heroTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10291A',
    borderWidth: 1,
    borderColor: '#285C39',
  },
  recommended: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#10291A',
  },
  recommendedText: { color: theme.colors.neon, fontSize: 8, fontWeight: '800', letterSpacing: 0.55 },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 21,
    maxWidth: 280,
  },
  heroCopy: { color: '#A7B1AA', fontSize: 11, lineHeight: 17, marginTop: 9, maxWidth: 285 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 20 },
  heroLine: { width: 24, height: 2, borderRadius: 2, backgroundColor: theme.colors.neon },
  heroFootText: { color: '#A7B1AA', fontSize: 8, fontWeight: '700', letterSpacing: 1.1 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 26, marginBottom: 12 },
  benefits: {
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 15 },
  benefitBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  benefitIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10291A',
  },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },
  benefitDescription: { color: theme.colors.secondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 15,
    marginTop: 15,
    borderRadius: 17,
    backgroundColor: '#12151A',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  footerMark: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102319',
  },
  footerText: { flex: 1, color: theme.colors.secondary, fontSize: 10, lineHeight: 15 },
});
