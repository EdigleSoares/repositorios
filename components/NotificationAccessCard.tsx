import { BellRing, Check, ExternalLink, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type NotificationAccessCardProps = {
  granted: boolean;
  available: boolean;
  message?: string;
  error?: string;
  onPress: () => void;
};

export function NotificationAccessCard({
  granted,
  available,
  message,
  error,
  onPress,
}: NotificationAccessCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <BellRing color={theme.colors.neon} size={17} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Leitura de notificações</Text>
          <Text style={styles.subtitle}>Anúncio automático de Pix do Nubank</Text>
        </View>
        <View
          style={[
            styles.permissionBadge,
            granted ? styles.permissionGranted : styles.permissionNeeded,
            !available && styles.permissionUnavailable,
          ]}>
          {!available ? (
            <Smartphone color={theme.colors.secondary} size={13} />
          ) : granted ? (
            <Check color={theme.colors.neon} size={13} strokeWidth={2.8} />
          ) : (
            <ShieldCheck color={theme.colors.secondary} size={13} />
          )}
          <Text style={[styles.permissionText, granted && styles.permissionTextGranted]}>
            {!available ? 'APK NECESSÁRIO' : granted ? 'ATIVA' : 'PERMISSÃO'}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>
        {!available
          ? 'O Expo Go não inclui o listener. Instale o APK PixFala de desenvolvimento ou preview para ativar esse recurso.'
          : granted
          ? 'Apenas notificações do Nubank são verificadas. A leitura não fica salva.'
          : 'Permita o acesso nas configurações do Android para ouvir os Pix recebidos.'}
      </Text>

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
        {!available ? (
          <Smartphone color={theme.colors.muted} size={15} />
        ) : granted ? (
          <ExternalLink color={theme.colors.neon} size={15} />
        ) : (
          <Smartphone color={theme.colors.neon} size={15} />
        )}
        <Text style={styles.buttonText}>
          {!available
            ? 'Abra o PixFala no APK instalado'
            : granted
              ? 'Gerenciar acesso no Android'
              : 'Ativar leitura de notificações'}
        </Text>
      </Pressable>

      {(message || error) && (
        <Text style={[styles.feedback, error && styles.feedbackError]}>{error ?? message}</Text>
      )}

      <View style={styles.privacyNote}>
        <ShieldCheck color={theme.colors.muted} size={13} />
        <Text style={styles.privacyText}>Somente Nubank · Processamento local no aparelho</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10291A',
  },
  headingCopy: { flex: 1 },
  title: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  subtitle: { color: theme.colors.secondary, fontSize: 10, marginTop: 4 },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  permissionGranted: { backgroundColor: '#10291A' },
  permissionNeeded: { backgroundColor: theme.colors.surfaceRaised },
  permissionUnavailable: { backgroundColor: theme.colors.surfaceRaised },
  permissionText: { color: theme.colors.secondary, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  permissionTextGranted: { color: theme.colors.neon },
  description: { color: theme.colors.secondary, fontSize: 11, lineHeight: 17, marginTop: 13 },
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 14,
    borderRadius: 13,
    backgroundColor: '#102319',
    borderWidth: 1,
    borderColor: '#1C5732',
  },
  buttonText: { color: theme.colors.neon, fontSize: 11, fontWeight: '700' },
  buttonDisabled: { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
  pressed: { opacity: 0.78 },
  feedback: { color: theme.colors.secondary, fontSize: 10, lineHeight: 15, marginTop: 10 },
  feedbackError: { color: '#FF9A9A' },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13 },
  privacyText: { color: theme.colors.muted, fontSize: 9 },
});
