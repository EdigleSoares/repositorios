import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Pause, Zap } from 'lucide-react-native';
import { AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankSelector } from '@/components/BankSelector';
import { NotificationAccessCard } from '@/components/NotificationAccessCard';
import { PixSimulator } from '@/components/PixSimulator';
import { StatusToggle } from '@/components/StatusToggle';
import { theme } from '@/constants/theme';
import {
  hasNotificationAccess,
  NotificationListenerUnavailableError,
  openNotificationAccessSettings,
  subscribeToNubankPix,
} from '@/services/nubankListener';

export default function HomeScreen() {
  const [active, setActive] = useState(true);
  const [notificationAccessGranted, setNotificationAccessGranted] = useState(false);
  const [notificationListenerAvailable, setNotificationListenerAvailable] = useState(true);
  const [notificationMessage, setNotificationMessage] = useState<string>();
  const [notificationError, setNotificationError] = useState<string>();
  const activeRef = useRef(active);

  const refreshNotificationAccess = useCallback(() => {
    void hasNotificationAccess()
      .then((granted) => {
        setNotificationListenerAvailable(true);
        setNotificationAccessGranted(granted);
        setNotificationError(undefined);
      })
      .catch((error: unknown) => {
        if (error instanceof NotificationListenerUnavailableError) {
          setNotificationListenerAvailable(false);
          setNotificationAccessGranted(false);
          setNotificationError(undefined);
        } else {
          setNotificationError(
            error instanceof Error ? error.message : 'Não foi possível verificar o acesso às notificações.',
          );
        }
      });
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshNotificationAccess();
    });

    refreshNotificationAccess();
    return () => appStateSubscription.remove();
  }, [refreshNotificationAccess]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !active || !notificationListenerAvailable) return;

    let cancelled = false;
    let notificationSubscription: { remove: () => void } | null = null;

    void subscribeToNubankPix(
      () => activeRef.current,
      (receipt) => {
        setNotificationError(undefined);
        setNotificationMessage(`Pix de R$ ${receipt.amount} recebido de ${receipt.payer}. Anúncio iniciado.`);
      },
      (error) => setNotificationError(error.message),
    )
      .then((subscription) => {
        if (cancelled) {
          subscription?.remove();
        } else {
          notificationSubscription = subscription;
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof NotificationListenerUnavailableError) {
            setNotificationListenerAvailable(false);
            setNotificationAccessGranted(false);
            setNotificationError(undefined);
          } else {
            setNotificationError(
              error instanceof Error ? error.message : 'Não foi possível iniciar a leitura do Nubank.',
            );
          }
        }
      });

    return () => {
      cancelled = true;
      notificationSubscription?.remove();
    };
  }, [active, notificationListenerAvailable]);

  const toggleStatus = () => {
    const next = !activeRef.current;
    activeRef.current = next;
    setActive(next);
  };

  const handleNotificationAccess = async () => {
    if (!notificationListenerAvailable) return;

    try {
      setNotificationError(undefined);
      await openNotificationAccessSettings();
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : 'Não foi possível abrir as configurações do Android.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <AudioLines color={theme.colors.neon} size={23} strokeWidth={2.4} />
            <Zap color={theme.colors.neon} size={19} fill={theme.colors.neon} strokeWidth={1.8} />
          </View>
          <Text style={styles.brandName}>PixFala</Text>
          <Text style={styles.brandCaption}>Seu Pix. Sua voz. Seu negócio.</Text>
        </View>

        <View style={styles.intro}>
          <View>
            <Text style={styles.eyebrow}>PAINEL DE CONTROLE</Text>
            <Text style={styles.heading}>Tudo em dia.</Text>
          </View>
          <View style={[styles.readyChip, !active && styles.pausedChip]}>
            {active ? (
              <Check color={theme.colors.neon} size={14} strokeWidth={2.8} />
            ) : (
              <Pause color={theme.colors.secondary} size={13} strokeWidth={2.8} />
            )}
            <Text style={[styles.readyText, !active && styles.pausedText]}>
              {active ? 'PRONTO' : 'PAUSADO'}
            </Text>
          </View>
        </View>

        <StatusToggle active={active} onToggle={toggleStatus} />

        {Platform.OS === 'android' && (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Conexão Nubank</Text>
              <Text style={styles.stepLabel}>ANDROID</Text>
            </View>
            <NotificationAccessCard
              granted={notificationAccessGranted}
              available={notificationListenerAvailable}
              message={
                active && notificationAccessGranted
                  ? notificationMessage ?? 'Leitura ativa. Aguardando um Pix do Nubank.'
                  : notificationAccessGranted
                    ? 'Acesso autorizado. Ative o PixFala para anunciar os Pix.'
                    : undefined
              }
              error={notificationError}
              onPress={handleNotificationAccess}
            />
          </>
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Teste rápido</Text>
          <Text style={styles.stepLabel}>SIMULAÇÃO</Text>
        </View>
        <PixSimulator active={active} />

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Sua configuração</Text>
          <Text style={styles.stepLabel}>01 / 02</Text>
        </View>
        <BankSelector />

        <View style={styles.note}>
          <View style={styles.noteMark}>
            <Zap color={theme.colors.neon} size={15} />
          </View>
          <Text style={styles.noteText}>
            Mantenha o app por perto para não perder nenhum pagamento.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 26,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 0,
    backgroundColor: '#102319',
    borderWidth: 1,
    borderColor: '#1E5732',
    shadowColor: theme.colors.neon,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  brandName: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 8,
  },
  brandCaption: {
    color: theme.colors.secondary,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heading: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 5,
  },
  readyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 3,
    borderRadius: 999,
    backgroundColor: '#102319',
  },
  pausedChip: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  readyText: {
    color: theme.colors.neon,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  pausedText: {
    color: theme.colors.secondary,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  stepLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 15,
    marginTop: 16,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#12151A',
  },
  noteMark: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102319',
  },
  noteText: {
    flex: 1,
    color: theme.colors.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
