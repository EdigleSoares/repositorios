import { BatteryCharging, BellRing, Check, Layers3, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export type PermissionStep = 'notifications' | 'overlay' | 'battery';

type PermissionSetupModalProps = {
  visible: boolean;
  available: boolean;
  notificationGranted: boolean;
  overlayGranted: boolean;
  batteryGranted: boolean;
  error?: string;
  onOpenStep: (step: PermissionStep) => void;
};

const steps: { id: PermissionStep; title: string; description: string; icon: typeof BellRing }[] = [
  {
    id: 'notifications',
    title: 'Leitura de notificações',
    description: 'Detecta avisos de recebimentos Pix.',
    icon: BellRing,
  },
  {
    id: 'overlay',
    title: 'Sobreposição sobre outros apps',
    description: 'Autoriza futuras confirmações flutuantes.',
    icon: Layers3,
  },
  {
    id: 'battery',
    title: 'Uso de bateria sem restrições',
    description: 'Ajuda a manter a escuta com a tela desligada.',
    icon: BatteryCharging,
  },
];

export function PermissionSetupModal({
  visible,
  available,
  notificationGranted,
  overlayGranted,
  batteryGranted,
  error,
  onOpenStep,
}: PermissionSetupModalProps) {
  const grantedByStep: Record<PermissionStep, boolean> = {
    notifications: notificationGranted,
    overlay: overlayGranted,
    battery: batteryGranted,
  };
  const currentStep = steps.find((step) => !grantedByStep[step.id]);
  const CurrentIcon = currentStep?.icon ?? ShieldCheck;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => undefined}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.icon}>
            {available ? (
              <CurrentIcon color={theme.colors.neon} size={24} />
            ) : (
              <Smartphone color={theme.colors.neon} size={24} />
            )}
          </View>
          <Text style={styles.title}>Configure o PixFala</Text>
          <Text style={styles.description}>
            Conceda as permissões abaixo. A escuta só será iniciada depois que o Android confirmar todas.
          </Text>

          <View style={styles.steps}>
            {steps.map((step, index) => {
              const granted = grantedByStep[step.id];
              const Icon = step.icon;
              return (
                <View key={step.id} style={styles.step}>
                  <View style={[styles.stepIcon, granted && styles.stepIconGranted]}>
                    {granted ? (
                      <Check color={theme.colors.neon} size={16} strokeWidth={2.7} />
                    ) : (
                      <Icon color={theme.colors.secondary} size={16} />
                    )}
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.stepTitle}>{index + 1}. {step.title}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  </View>
                  <Text style={[styles.stepStatus, granted && styles.stepStatusGranted]}>
                    {granted ? 'Concedido' : 'Pendente'}
                  </Text>
                </View>
              );
            })}
          </View>

          {!available && (
            <Text style={styles.error}>
              Instale o APK PixFala atualizado. O Expo Go não contém o listener nativo.
            </Text>
          )}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

          {currentStep && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !available }}
              disabled={!available}
              onPress={() => onOpenStep(currentStep.id)}
              style={({ pressed }) => [
                styles.button,
                !available && styles.buttonDisabled,
                pressed && available && styles.pressed,
              ]}>
              <ShieldCheck color={available ? theme.colors.black : theme.colors.muted} size={17} />
              <Text style={[styles.buttonText, !available && styles.buttonTextDisabled]}>
                {!available
                  ? 'Instale o APK atualizado'
                  : currentStep.id === 'notifications'
                    ? 'Ativar leitura de notificações'
                    : currentStep.id === 'overlay'
                      ? 'Permitir sobreposição'
                      : 'Permitir uso sem restrições'}
              </Text>
            </Pressable>
          )}

          <Text style={styles.footnote}>
            O status é revalidado ao retornar das configurações do Android.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    padding: 22,
    borderRadius: 25,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  icon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#10291A',
    borderWidth: 1,
    borderColor: '#1C5732',
  },
  title: { marginTop: 17, color: theme.colors.text, fontSize: 21, fontWeight: '700' },
  description: { marginTop: 8, color: theme.colors.secondary, fontSize: 12, lineHeight: 18 },
  steps: {
    gap: 5,
    padding: 11,
    marginTop: 17,
    borderRadius: 17,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 56 },
  stepIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceRaised,
  },
  stepIconGranted: { backgroundColor: '#10291A' },
  stepCopy: { flex: 1 },
  stepTitle: { color: theme.colors.text, fontSize: 10, fontWeight: '700' },
  stepDescription: { color: theme.colors.muted, fontSize: 9, marginTop: 3 },
  stepStatus: { color: theme.colors.muted, fontSize: 9, fontWeight: '700' },
  stepStatusGranted: { color: theme.colors.neon },
  error: { color: '#FF9A9A', fontSize: 10, lineHeight: 15, marginTop: 11 },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.neon,
  },
  buttonDisabled: { backgroundColor: theme.colors.surfaceRaised },
  buttonText: { color: theme.colors.black, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  buttonTextDisabled: { color: theme.colors.muted },
  pressed: { opacity: 0.82 },
  footnote: { color: theme.colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 12 },
});
