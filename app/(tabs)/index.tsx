import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Pause, Zap } from 'lucide-react-native';
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankSelector } from '@/components/BankSelector';
import { BatteryOptimizationModal } from '@/components/BatteryOptimizationModal';
import { NotificationPermissionModal } from '@/components/NotificationPermissionModal';
import { StatusToggle } from '@/components/StatusToggle';
import { theme } from '@/constants/theme';
import {
  hasNotificationAccess,
  hasBatteryOptimizationExemption,
  NotificationListenerUnavailableError,
  openNotificationAccessSettings,
  requestBatteryOptimizationExemption,
  subscribeToBankPix,
} from '@/services/bankNotificationListener';

export default function HomeScreen() {
  const [active, setActive] = useState(true);
  const [notificationAccessGranted, setNotificationAccessGranted] = useState(false);
  const [notificationListenerAvailable, setNotificationListenerAvailable] = useState(true);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [notificationError, setNotificationError] = useState<string>();
  const [batteryOptimizationExempt, setBatteryOptimizationExempt] = useState(false);
  const [batteryPermissionChecked, setBatteryPermissionChecked] = useState(false);
  const [batteryPermissionError, setBatteryPermissionError] = useState<string>();
  const activeRef = useRef(active);

  const refreshNotificationAccess = useCallback(() => {
    void hasNotificationAccess()
      .then(async (granted) => {
        setNotificationListenerAvailable(true);
        setNotificationAccessGranted(granted);
        setPermissionChecked(true);
        setNotificationError(undefined);
        if (!granted) {
          setBatteryOptimizationExempt(false);
          setBatteryPermissionChecked(false);
          setBatteryPermissionError(undefined);
          return;
        }

        setBatteryPermissionError(undefined);
        try {
          const exempt = await hasBatteryOptimizationExemption();
          setBatteryOptimizationExempt(exempt);
          setBatteryPermissionChecked(true);
        } catch (error) {
          setBatteryOptimizationExempt(false);
          setBatteryPermissionChecked(true);
          setBatteryPermissionError(
            error instanceof Error
              ? error.message
              : 'Não foi possível verificar as restrições de bateria.',
          );
        }
      })
      .catch((error: unknown) => {
        if (error instanceof NotificationListenerUnavailableError) {
          setNotificationListenerAvailable(false);
          setNotificationAccessGranted(false);
          setBatteryOptimizationExempt(false);
          setPermissionChecked(true);
          setBatteryPermissionChecked(false);
          setNotificationError(undefined);
        } else {
          setPermissionChecked(true);
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
    if (
      Platform.OS !== 'android' ||
      !active ||
      !notificationListenerAvailable ||
      !notificationAccessGranted ||
      !batteryPermissionChecked ||
      !batteryOptimizationExempt
    ) {
      return;
    }

    let cancelled = false;
    let notificationSubscription: { remove: () => void } | null = null;

    void subscribeToBankPix(
      () => activeRef.current,
      undefined,
      (error) => Alert.alert('Atenção ao Pix recebido', error.message),
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
            const message =
              error instanceof Error ? error.message : 'Não foi possível iniciar a leitura das notificações.';
            setNotificationError(message);
            Alert.alert('Leitura de notificações indisponível', message);
          }
        }
      });

    return () => {
      cancelled = true;
      notificationSubscription?.remove();
    };
  }, [
    active,
    batteryOptimizationExempt,
    batteryPermissionChecked,
    notificationAccessGranted,
    notificationListenerAvailable,
  ]);

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
      const message =
        error instanceof Error ? error.message : 'Não foi possível abrir as configurações do Android.';
      setNotificationError(message);
      Alert.alert('Configurações indisponíveis', message);
    }
  };

  const handleBatteryOptimization = async () => {
    if (!notificationListenerAvailable) return;

    try {
      setBatteryPermissionError(undefined);
      await requestBatteryOptimizationExemption();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível abrir as configurações de bateria.';
      setBatteryPermissionError(message);
      Alert.alert('Configuração de bateria indisponível', message);
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

        <Text style={styles.sectionTitle}>Banco para Pix</Text>
        <BankSelector />
        <View style={styles.licenseStatus}>
          <Check color={theme.colors.neon} size={15} strokeWidth={2.6} />
          <Text style={styles.licenseStatusText}>Status da Licença: Ativa ✓</Text>
        </View>
      </ScrollView>
      {Platform.OS === 'android' && (
        <>
          <NotificationPermissionModal
            visible={permissionChecked && !notificationAccessGranted}
            available={notificationListenerAvailable}
            error={notificationError}
            onPress={handleNotificationAccess}
          />
          <BatteryOptimizationModal
            visible={permissionChecked && notificationAccessGranted && batteryPermissionChecked && !batteryOptimizationExempt}
            available={notificationListenerAvailable}
            error={batteryPermissionError}
            onPress={handleBatteryOptimization}
          />
        </>
      )}
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
    marginBottom: 28,
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
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 26,
    marginBottom: 12,
  },
  licenseStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 22,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  licenseStatusText: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
