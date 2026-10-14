import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, LockKeyhole, Pencil, Save, ShieldCheck, UnlockKeyhole } from 'lucide-react-native';

import { theme } from '@/constants/theme';
import {
  savePixChargeConfig,
  type PixChargeConfig,
  type PixChargeConfigInput,
} from '@/services/pixChargeService';

type PixChargeSettingsProps = {
  config: PixChargeConfig | null;
  onSaved: (config: PixChargeConfig) => void;
};

function MaskedPixKey({ value }: { value: string }) {
  const visiblePart = value.slice(-4);
  return <Text style={styles.savedValue}>•••• {visiblePart}</Text>;
}

export function PixChargeSettings({ config, onSaved }: PixChargeSettingsProps) {
  return (
    <PixChargeSettingsForm
      key={config ? JSON.stringify(config) : 'unconfigured'}
      config={config}
      onSaved={onSaved}
    />
  );
}

function PixChargeSettingsForm({ config, onSaved }: PixChargeSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(!config);
  const [pixKey, setPixKey] = useState(config?.pixKey ?? '');
  const [merchantName, setMerchantName] = useState(config?.merchantName ?? '');
  const [merchantCity, setMerchantCity] = useState(config?.merchantCity ?? '');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setEditing(true);
    setExpanded(true);
  };

  const handleCancelEdit = () => {
    setPixKey(config?.pixKey ?? '');
    setMerchantName(config?.merchantName ?? '');
    setMerchantCity(config?.merchantCity ?? '');
    setEditing(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const input: PixChargeConfigInput = { pixKey, merchantName, merchantCity };
      const savedConfig = await savePixChargeConfig(input);
      setPixKey(savedConfig.pixKey);
      setMerchantName(savedConfig.merchantName);
      setMerchantCity(savedConfig.merchantCity);
      setEditing(false);
      setExpanded(false);
      onSaved(savedConfig);
      Alert.alert('Chave Pix salva', 'Sua chave de cobrança foi protegida neste aparelho.');
    } catch (error) {
      Alert.alert(
        'Confira os dados',
        error instanceof Error ? error.message : 'Não foi possível salvar a chave Pix.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.headerIcon}>
          {config ? (
            <LockKeyhole color={theme.colors.neon} size={18} />
          ) : (
            <ShieldCheck color={theme.colors.neon} size={18} />
          )}
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Chave Pix de cobrança</Text>
          <Text style={styles.subtitle}>
            {config
              ? `Salva • ${config.pixKeyType} • toque para editar`
              : 'Cadastre para gerar cobranças por QR Code'}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp color={theme.colors.secondary} size={19} />
        ) : (
          <ChevronDown color={theme.colors.secondary} size={19} />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {config && !editing ? (
            <View style={styles.lockedSummary}>
              <View style={styles.summaryCopy}>
                <Text style={styles.fieldLabel}>CHAVE PROTEGIDA • {config.pixKeyType.toUpperCase()}</Text>
                <MaskedPixKey value={config.pixKey} />
                <Text style={styles.merchantSummary}>{config.merchantName} • {config.merchantCity}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Desbloquear e editar chave Pix"
                onPress={handleEdit}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Pencil color={theme.colors.neon} size={17} />
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>CHAVE PIX</Text>
              <TextInput
                accessibilityLabel="Chave Pix do recebedor"
                autoCapitalize="none"
                autoCorrect={false}
                editable={editing}
                keyboardType="default"
                onChangeText={setPixKey}
                placeholder="CPF, CNPJ, telefone, e-mail ou aleatória"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, !editing && styles.inputLocked]}
                value={pixKey}
              />

              <Text style={styles.fieldLabel}>NOME DO RECEBEDOR</Text>
              <TextInput
                accessibilityLabel="Nome do recebedor no Pix"
                autoCapitalize="words"
                editable={editing}
                onChangeText={setMerchantName}
                placeholder="Nome ou nome da empresa"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, !editing && styles.inputLocked]}
                value={merchantName}
                maxLength={25}
              />

              <Text style={styles.fieldLabel}>CIDADE DO RECEBEDOR</Text>
              <TextInput
                accessibilityLabel="Cidade do recebedor no Pix"
                autoCapitalize="characters"
                editable={editing}
                onChangeText={setMerchantCity}
                placeholder="Ex.: FORTALEZA"
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, !editing && styles.inputLocked]}
                value={merchantCity}
                maxLength={15}
              />

              <Text style={styles.helper}>
                A chave é protegida neste aparelho. Nome e cidade aparecem na cobrança.
              </Text>
              <View style={styles.actions}>
                {config && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCancelEdit}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                    <LockKeyhole color={theme.colors.secondary} size={16} />
                    <Text style={styles.secondaryLabel}>Cancelar</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void handleSave()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    saving && styles.savingButton,
                    pressed && styles.pressed,
                  ]}>
                  {config ? (
                    <UnlockKeyhole color={theme.colors.black} size={17} />
                  ) : (
                    <Save color={theme.colors.black} size={17} />
                  )}
                  <Text style={styles.saveLabel}>
                    {saving ? 'Salvando...' : config ? 'Salvar e bloquear' : 'Salvar chave'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
          {config && !editing && (
            <Text style={styles.lockHint}>Toque no lápis para editar.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15 },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#10291A',
  },
  headerCopy: { flex: 1, gap: 4 },
  title: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  subtitle: { color: theme.colors.secondary, fontSize: 10 },
  body: { paddingHorizontal: 15, paddingBottom: 16 },
  fieldLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 7 },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.black,
    color: theme.colors.text,
    fontSize: 13,
  },
  inputLocked: { opacity: 0.55 },
  helper: { color: theme.colors.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 15 },
  saveButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: theme.colors.neon,
  },
  savingButton: { opacity: 0.6 },
  saveLabel: { color: theme.colors.black, fontSize: 12, fontWeight: '800' },
  secondaryButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryLabel: { color: theme.colors.secondary, fontSize: 11, fontWeight: '700' },
  lockedSummary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryCopy: { flex: 1 },
  savedValue: { color: theme.colors.text, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  merchantSummary: { color: theme.colors.secondary, fontSize: 11, marginTop: 7 },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#10291A',
    borderWidth: 1,
    borderColor: '#275137',
  },
  lockHint: { color: theme.colors.muted, fontSize: 10, marginTop: 12 },
  pressed: { opacity: 0.75 },
});
