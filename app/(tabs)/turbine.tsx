import { useState } from 'react';
import { ArrowUpRight, BadgeCheck, Bot, Globe, MessageCircle, Sparkles, Utensils } from 'lucide-react-native';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

const whatsappNumber = '5585989157389';

const services = [
  {
    icon: Globe,
    title: 'Site & Landing Page',
    description: 'Coloque sua empresa no Google e passe mais credibilidade aos seus clientes.',
    message: 'Olá Ediglê, vim pelo app PixFala e gostaria de um orçamento para um Site / Landing Page.',
    action: 'Pedir orçamento',
  },
  {
    icon: Utensils,
    title: 'Cardápio Digital',
    description: 'Receba pedidos organizados no seu WhatsApp sem pagar taxas de aplicativo.',
    message: 'Olá Ediglê, vim pelo app PixFala e gostaria de um orçamento para um Cardápio Digital.',
    action: 'Quero meu cardápio',
  },
  {
    icon: Bot,
    title: 'Chatbot com IA',
    description: 'Atenda seus clientes automaticamente 24 horas por dia no WhatsApp.',
    message: 'Olá Ediglê, vim pelo app PixFala e gostaria de informações sobre o Chatbot com IA.',
    action: 'Conhecer o chatbot',
  },
  {
    icon: BadgeCheck,
    title: 'Plaquinha NFC para Google Meu Negócio',
    description: 'Ganhe avaliações 5 estrelas no Google aproximando o celular do cliente.',
    message: 'Olá Ediglê, vim pelo app PixFala e gostaria de pedir a Plaquinha NFC do Google.',
    action: 'Pedir minha plaquinha',
  },
];

export default function BusinessScreen() {
  const [openingService, setOpeningService] = useState<string>();

  const contactService = async (title: string, message: string) => {
    setOpeningService(title);
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Não foi possível abrir o WhatsApp',
        error instanceof Error ? error.message : 'Tente novamente em instantes.',
      );
    } finally {
      setOpeningService(undefined);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>PIX FALA, NEGÓCIO CRESCE</Text>
        <Text style={styles.title}>Turbine seu negócio</Text>
        <Text style={styles.subtitle}>
          Soluções digitais para atrair clientes, agilizar seu atendimento e fazer seu negócio crescer.
        </Text>

        <View style={styles.promo}>
          <View style={styles.promoIcon}>
            <Sparkles color={theme.colors.neon} size={20} />
          </View>
          <View style={styles.promoCopy}>
            <Text style={styles.promoTitle}>Ideias que viram resultados</Text>
            <Text style={styles.promoDescription}>Fale direto com a gente pelo WhatsApp.</Text>
          </View>
          <ArrowUpRight color={theme.colors.neon} size={18} />
        </View>

        <Text style={styles.sectionTitle}>Soluções para o seu negócio</Text>
        <View style={styles.serviceList}>
          {services.map((service, index) => {
            const Icon = service.icon;
            const opening = openingService === service.title;
            return (
              <View key={service.title} style={styles.serviceCard}>
                <View style={styles.cardTop}>
                  <View style={styles.serviceIcon}>
                    <Icon color={theme.colors.neon} size={20} strokeWidth={1.9} />
                  </View>
                  <Text style={styles.serviceNumber}>0{index + 1}</Text>
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${service.action} pelo WhatsApp`}
                  accessibilityState={{ disabled: opening }}
                  disabled={opening}
                  onPress={() => void contactService(service.title, service.message)}
                  style={({ pressed }) => [
                    styles.contactButton,
                    pressed && styles.pressed,
                    opening && styles.buttonOpening,
                  ]}>
                  <MessageCircle color={theme.colors.black} size={16} strokeWidth={2.2} />
                  <Text style={styles.contactLabel}>{opening ? 'Abrindo WhatsApp...' : service.action}</Text>
                  {!opening && <ArrowUpRight color={theme.colors.black} size={15} />}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer}>Atendimento direto e sem compromisso.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 22, paddingTop: 23, paddingBottom: 30 },
  eyebrow: { color: theme.colors.neon, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.8, marginTop: 7 },
  subtitle: { color: theme.colors.secondary, fontSize: 12, lineHeight: 19, marginTop: 9, marginBottom: 17 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#151E19',
    borderWidth: 1,
    borderColor: '#275137',
  },
  promoIcon: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#10291A',
  },
  promoCopy: { flex: 1 },
  promoTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  promoDescription: { color: theme.colors.secondary, fontSize: 10, marginTop: 4 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  serviceList: { gap: 12 },
  serviceCard: {
    padding: 17,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceIcon: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#10291A',
    borderWidth: 1,
    borderColor: '#1E5732',
  },
  serviceNumber: { color: theme.colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  serviceTitle: { color: theme.colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700', marginTop: 14 },
  serviceDescription: { color: theme.colors.secondary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  contactButton: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 15,
    borderRadius: 13,
    backgroundColor: theme.colors.neon,
  },
  contactLabel: { flex: 1, color: theme.colors.black, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonOpening: { opacity: 0.7 },
  footer: { color: theme.colors.muted, fontSize: 10, textAlign: 'center', marginTop: 18 },
});
