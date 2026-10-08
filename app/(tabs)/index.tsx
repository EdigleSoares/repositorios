import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Pause, Zap } from 'lucide-react-native';
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PermissionSetupModal,
  type PermissionStep,
} from '@/components/PermissionSetupModal';
import { StatusToggle } from '@/components/StatusToggle';
import { PixChargeGenerator } from '@/components/PixChargeGenerator';
import { PixChargeSettings } from '@/components/PixChargeSettings';
import { theme } from '@/constants/theme';
import {
  hasNotificationAccess,
  hasBatteryOptimizationExemption,
  hasOverlayPermission,
  NotificationListenerUnavailableError,
  openNotificationAccessSettings,
  requestOverlayPermission,
  requestBatteryOptimizationExemption,
  isPixMonitoringEnabled,
  setPixMonitoringEnabled,
  subscribeToBankPix,
} from '@/services/bankNotificationListener';
import { getPixChargeConfig, type PixChargeConfig } from '@/services/pixChargeService';

export default function HomeScreen() {
  const [active, setActive] = useState(true);
  const [notificationAccessGranted, setNotificationAccessGranted] = useState(false);
  const [overlayPermissionGranted, setOverlayPermissionGranted] = useState(false);
  const [notificationListenerAvailable, setNotificationListenerAvailable] = useState(true);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [batteryOptimizationExempt, setBatteryOptimizationExempt] = useState(false);
  const [permissionError, setPermissionError] = useState<string>();
  const [pixChargeConfig, setPixChargeConfig] = useState<PixChargeConfig | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    let mounted = true;
    void getPixChargeConfig()
      .then((config) => {
        if (mounted) setPixChargeConfig(config);
      })
      .catch((error: unknown) => {
        if (mounted) {
          Alert.alert(
            'Configuração da cobrança',
            error instanceof Error ? error.message : 'Não foi possível carregar a chave Pix salva.',
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refreshNotificationAccess = useCallback(() => {
    void Promise.all([
      hasNotificationAccess(),
      hasOverlayPermission(),
      hasBatteryOptimizationExemption(),
      isPixMonitoringEnabled(),
    ])
      .then(([notificationGranted, overlayGranted, batteryExempt, monitoringEnabled]) => {
        setNotificationListenerAvailable(true);
        setNotificationAccessGranted(notificationGranted);
        setOverlayPermissionGranted(overlayGranted);
        setBatteryOptimizationExempt(batteryExempt);
        activeRef.current = monitoringEnabled;
        setActive(monitoringEnabled);
        setPermissionError(undefined);
        setPermissionChecked(true);
      })
      .catch((error: unknown) => {
        if (error instanceof NotificationListenerUnavailableError) {
          setNotificationListenerAvailable(false);
          setNotificationAccessGranted(false);
          setOverlayPermissionGranted(false);
          setBatteryOptimizationExempt(false);
          activeRef.current = false;
          setActive(false);
          setPermissionChecked(true);
          setPermissionError(undefined);
        } else {
          setPermissionChecked(true);
          setNotificationListenerAvailable(true);
          setNotificationAccessGranted(false);
          setOverlayPermissionGranted(false);
          setBatteryOptimizationExempt(false);
          activeRef.current = false;
          setActive(false);
          setPermissionError(
            error instanceof Error
              ? `Não foi possível verificar as permissões: ${error.message}`
              : 'Não foi possível verificar as permissões do Android.',
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
      !notificationAccessGranted
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
            setPermissionError(undefined);
          } else {
            const message =
              error instanceof Error ? error.message : 'Não foi possível iniciar a leitura das notificações.';
            setPermissionError(message);
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
    notificationAccessGranted,
    notificationListenerAvailable,
  ]);

  const toggleStatus = () => {
    const next = !activeRef.current;
    void setPixMonitoringEnabled(next)
      .then(() => {
        activeRef.current = next;
        setActive(next);
      })
      .catch((error: unknown) => {
        Alert.alert(
          'Não foi possível alterar o monitoramento',
          error instanceof Error ? error.message : 'Tente novamente.',
        );
      });
  };

  const handlePermissionStep = async (step: PermissionStep) => {
    if (!notificationListenerAvailable) return;

    try {
      setPermissionError(undefined);
      if (step === 'notifications') {
        await openNotificationAccessSettings();
      } else if (step === 'overlay') {
        await requestOverlayPermission();
      } else {
        await requestBatteryOptimizationExemption();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível abrir a configuração solicitada.';
      setPermissionError(message);
      Alert.alert('Configuração indisponível', message);
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
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>PixFala</Text>
            <Text style={styles.brandCaption}>Seu Pix. Sua voz. Seu negócio.</Text>
          </View>
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

        <Text style={styles.sectionTitle}>Monitoramento de recebimentos</Text>
        <StatusToggle active={active} onToggle={toggleStatus} />

        <Text style={styles.sectionTitle}>Cobrança no balcão</Text>
        <PixChargeGenerator config={pixChargeConfig} />

        <Text style={styles.sectionTitle}>Configuração da cobrança</Text>
        <PixChargeSettings
          config={pixChargeConfig}
          onSaved={setPixChargeConfig}
        />

        <Text style={styles.sectionTitle}>Captura de Pix</Text>
        <View style={styles.captureCard}>
          <View style={styles.captureIcon}>
            <Zap color={theme.colors.neon} size={18} fill={theme.colors.neon} />
          </View>
          <View style={styles.captureCopy}>
            <Text style={styles.captureTitle}>Detecção automática</Text>
            <Text style={styles.captureDescription}>
              O PixFala analisa notificações recebidas de qualquer aplicativo e ignora mensagens que não indiquem um Pix recebido.
            </Text>
          </View>
        </View>
        <View style={styles.licenseStatus}>
          <Check color={theme.colors.neon} size={15} strokeWidth={2.6} />
          <Text style={styles.licenseStatusText}>Status da Licença: Ativa ✓</Text>
        </View>
      </ScrollView>
      {Platform.OS === 'android' && (
        <PermissionSetupModal
          visible={
            permissionChecked &&
            (!notificationAccessGranted || !overlayPermissionGranted || !batteryOptimizationExempt)
          }
          available={notificationListenerAvailable}
          notificationGranted={notificationAccessGranted}
          overlayGranted={overlayPermissionGranted}
          batteryGranted={batteryOptimizationExempt}
          error={permissionError}
          onOpenStep={(step) => void handlePermissionStep(step)}
        />
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
    paddingTop: 8,
    paddingBottom: 26,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 16,
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
    marginTop: 0,
  },
  brandCopy: { alignItems: 'flex-start' },
  brandCaption: {
    color: theme.colors.secondary,
    fontSize: 12,
    marginTop: 2,
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
    marginTop: 18,
    marginBottom: 8,
  },
  captureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  captureIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#10291A',
  },
  captureCopy: { flex: 1 },
  captureTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  captureDescription: { color: theme.colors.secondary, fontSize: 10, lineHeight: 15, marginTop: 5 },
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
