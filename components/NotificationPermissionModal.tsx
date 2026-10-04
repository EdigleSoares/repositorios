import { BellRing, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type NotificationPermissionModalProps = {
  visible: boolean;
  available: boolean;
  error?: string;
  onPress: () => void;
};

export function NotificationPermissionModal({
  visible,
  available,
  error,
  onPress,
}: NotificationPermissionModalProps) {
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
              <BellRing color={theme.colors.neon} size={24} />
            ) : (
              <Smartphone color={theme.colors.neon} size={24} />
            )}
          </View>

          <Text style={styles.title}>Permissão necessária</Text>
          <Text style={styles.description}>
            {available
              ? 'Para anunciar seus recebimentos, o PixFala precisa ler as notificações dos bancos compatíveis. O processamento acontece no aparelho.'
              : 'A leitura de notificações precisa do APK PixFala de desenvolvimento ou preview. O Expo Go não inclui esse recurso.'}
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

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
              {available ? 'Ativar Permissão de Notificações' : 'Abra o PixFala no APK instalado'}
            </Text>
          </Pressable>

          <View style={styles.privacy}>
            <ShieldCheck color={theme.colors.muted} size={13} />
            <Text style={styles.privacyText}>Acesso usado apenas para identificar Pix recebidos.</Text>
          </View>
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
  title: {
    marginTop: 20,
    color: theme.colors.text,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  description: {
    marginTop: 10,
    color: theme.colors.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
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
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 17 },
  privacyText: { color: theme.colors.muted, fontSize: 9, textAlign: 'center' },
});
