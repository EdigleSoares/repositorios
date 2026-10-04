import { BatteryCharging, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type BatteryOptimizationModalProps = {
  visible: boolean;
  available: boolean;
  error?: string;
  onPress: () => void;
};

export function BatteryOptimizationModal({
  visible,
  available,
  error,
  onPress,
}: BatteryOptimizationModalProps) {
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
              <BatteryCharging color={theme.colors.neon} size={24} />
            ) : (
              <Smartphone color={theme.colors.neon} size={24} />
            )}
          </View>
          <Text style={styles.title}>Permita a execução em segundo plano</Text>
          <Text style={styles.description}>
            Para continuar monitorando Pix com a tela desligada, o Android precisa remover as restrições
            de bateria do PixFala. Esta solicitação será confirmada pelo próprio sistema.
          </Text>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !available }}
            disabled={!available}
            onPress={onPress}
            style={({ pressed }) => [
              styles.button,
              !available && styles.buttonDisabled,
              pressed && available && styles.pressed,
            ]}>
            <ShieldCheck color={available ? theme.colors.black : theme.colors.muted} size={17} />
            <Text style={[styles.buttonText, !available && styles.buttonTextDisabled]}>
              {available ? 'Permitir execução sem restrições' : 'Instale o APK PixFala atualizado'}
            </Text>
          </Pressable>
          <Text style={styles.footnote}>
            O PixFala só considera a permissão ativa após o Android confirmar a alteração.
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
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 25,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  icon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#10291A',
    borderWidth: 1,
    borderColor: '#1C5732',
  },
  title: { marginTop: 20, color: theme.colors.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  description: { marginTop: 10, color: theme.colors.secondary, fontSize: 13, lineHeight: 20 },
  error: { color: '#FF9A9A', fontSize: 11, lineHeight: 16, marginTop: 12 },
  button: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 12,
    marginTop: 22,
    borderRadius: 15,
    backgroundColor: theme.colors.neon,
  },
  buttonDisabled: { backgroundColor: theme.colors.surfaceRaised },
  buttonText: { color: theme.colors.black, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  buttonTextDisabled: { color: theme.colors.muted },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  footnote: { color: theme.colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 15 },
});
