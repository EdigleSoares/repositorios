import { useEffect, useState, type ReactNode } from 'react';
import { BadgeCheck, KeyRound, ShieldCheck } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '@/constants/theme';
import { activateLicense, isLicenseActivated } from '@/services/licenseService';

type LicenseGateProps = {
  children: ReactNode;
};

export function LicenseGate({ children }: LicenseGateProps) {
  const [activated, setActivated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activating, setActivating] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    let mounted = true;
    void isLicenseActivated()
      .then((isActivated) => {
        if (mounted) setActivated(isActivated);
      })
      .catch((checkError: unknown) => {
        if (mounted) {
          setError(
            checkError instanceof Error
              ? `Não foi possível verificar a licença: ${checkError.message}`
              : 'Não foi possível verificar a licença. Tente novamente.',
          );
        }
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleActivate = async () => {
    if (activating) return;

    setActivating(true);
    setError(undefined);
    try {
      const success = await activateLicense(licenseKey);
      if (!success) {
        setError('A chave informada não é válida. Confira e tente novamente.');
        return;
      }

      setActivated(true);
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? `Não foi possível salvar a ativação: ${activationError.message}`
          : 'Não foi possível salvar a ativação. Tente novamente.',
      );
    } finally {
      setActivating(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.neon} size="large" />
          <Text style={styles.loadingText}>Verificando licença...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (activated) return children;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.brandMark}>
          <KeyRound color={theme.colors.neon} size={25} strokeWidth={2} />
        </View>
        <Text style={styles.eyebrow}>PIX FALA • ATIVAÇÃO</Text>
        <Text style={styles.title}>Ativação do PixFala Necessária</Text>
        <Text style={styles.description}>
          Insira sua chave de licença para liberar os recursos e começar a anunciar seus recebimentos.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>CHAVE DE LICENÇA</Text>
          <TextInput
            accessibilityLabel="Chave de licença"
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setLicenseKey}
            onSubmitEditing={() => void handleActivate()}
            placeholder="Digite sua chave"
            placeholderTextColor={theme.colors.muted}
            returnKeyType="done"
            style={styles.input}
            value={licenseKey}
          />
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: activating || licenseKey.trim().length === 0 }}
            disabled={activating || licenseKey.trim().length === 0}
            onPress={() => void handleActivate()}
            style={({ pressed }) => [
              styles.activateButton,
              (activating || licenseKey.trim().length === 0) && styles.disabledButton,
              pressed && styles.pressed,
            ]}>
            {activating ? (
              <ActivityIndicator color={theme.colors.black} size="small" />
            ) : (
              <BadgeCheck color={theme.colors.black} size={18} strokeWidth={2.4} />
            )}
            <Text style={styles.activateText}>Ativar Dispositivo</Text>
          </Pressable>
        </View>

        <View style={styles.deviceNotice}>
          <ShieldCheck color={theme.colors.neon} size={17} />
          <Text style={styles.noticeText}>Esta licença é válida para ativação neste aparelho.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13 },
  loadingText: { color: theme.colors.secondary, fontSize: 12 },
  brandMark: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#10291A',
    borderWidth: 1,
    borderColor: '#1E5732',
    marginBottom: 22,
  },
  eyebrow: { color: theme.colors.neon, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: theme.colors.text, fontSize: 26, lineHeight: 33, fontWeight: '800', letterSpacing: -0.8, marginTop: 8 },
  description: { color: theme.colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 10 },
  card: {
    padding: 18,
    marginTop: 25,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: { color: theme.colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  input: {
    height: 52,
    paddingHorizontal: 14,
    marginTop: 11,
    color: theme.colors.text,
    fontSize: 15,
    letterSpacing: 1,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  error: { color: '#FF9A9A', fontSize: 11, lineHeight: 16, marginTop: 10 },
  activateButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 15,
    borderRadius: 14,
    backgroundColor: theme.colors.neon,
  },
  disabledButton: { opacity: 0.48 },
  pressed: { opacity: 0.8 },
  activateText: { color: theme.colors.black, fontSize: 13, fontWeight: '800' },
  deviceNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  noticeText: { color: theme.colors.muted, fontSize: 10, textAlign: 'center' },
});
