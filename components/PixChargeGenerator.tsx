import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { CircleCheck, QrCode, RotateCcw, X } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { theme } from '@/constants/theme';
import {
  createPixChargePayload,
  type PixChargeConfig,
} from '@/services/pixChargeService';

type PixChargeGeneratorProps = {
  config: PixChargeConfig | null;
};

type GeneratedCharge = {
  brCode: string;
  amountInCents: number;
};

const MAX_AMOUNT_CENTS = 999_999_999_999;

function formatCurrencyFromCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseAmountInput(value: string): { cents: number | null; display: string } {
  const digits = value.replace(/\D/gu, '').slice(0, 12);
  if (!digits) return { cents: null, display: '' };
  const cents = Math.min(Number(digits), MAX_AMOUNT_CENTS);
  return { cents, display: formatCurrencyFromCents(cents) };
}

export function PixChargeGenerator({ config }: PixChargeGeneratorProps) {
  const [amount, setAmount] = useState('');
  const [amountInCents, setAmountInCents] = useState<number | null>(null);
  const [charge, setCharge] = useState<GeneratedCharge | null>(null);
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const qrSize = Math.min(Math.max(width - 80, 220), 320);

  const handleAmountChange = (value: string) => {
    const parsed = parseAmountInput(value);
    setAmount(parsed.display);
    setAmountInCents(parsed.cents);
    setCharge(null);
  };

  const handleGenerate = () => {
    if (!config) {
      Alert.alert('Configure sua chave Pix', 'Salve a chave de cobrança antes de gerar um QR Code.');
      return;
    }
    if (!amountInCents) {
      Alert.alert('Informe o valor', 'Digite um valor maior que R$ 0,00 para gerar a cobrança.');
      return;
    }

    try {
      const payload = createPixChargePayload(config, amountInCents);
      setCharge({ brCode: payload.brCode, amountInCents });
      setVisible(true);
    } catch (error) {
      Alert.alert(
        'Não foi possível gerar o QR Code',
        error instanceof Error ? error.message : 'Confira o valor e os dados da chave Pix.',
      );
    }
  };

  const clearCharge = () => {
    setVisible(false);
    setCharge(null);
    setAmount('');
    setAmountInCents(null);
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.icon}>
            <QrCode color={theme.colors.neon} size={20} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>Cobrar com QR Code Pix</Text>
            <Text style={styles.subtitle}>Valor exato, pronto para escanear no balcão</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>VALOR DA COBRANÇA</Text>
        <View style={styles.amountField}>
          <Text style={styles.currencySymbol}>R$</Text>
          <TextInput
            accessibilityLabel="Valor exato da cobrança Pix"
            editable={Boolean(config)}
            keyboardType="decimal-pad"
            onChangeText={handleAmountChange}
            placeholder="0,00"
            placeholderTextColor={theme.colors.muted}
            returnKeyType="done"
            selectTextOnFocus
            style={styles.amountInput}
            value={amount}
          />
        </View>

        {!config && (
          <Text style={styles.hint}>
            Primeiro, configure e salve a chave Pix na seção abaixo.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={!config || !amountInCents}
          onPress={handleGenerate}
          style={({ pressed }) => [
            styles.generateButton,
            (!config || !amountInCents) && styles.disabledButton,
            pressed && Boolean(config && amountInCents) && styles.pressed,
          ]}>
          <QrCode color={config && amountInCents ? theme.colors.black : theme.colors.muted} size={20} />
          <Text style={[styles.generateLabel, (!config || !amountInCents) && styles.disabledLabel]}>
            Gerar QR Code Pix
          </Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
        transparent
        visible={visible && charge !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <CircleCheck color={theme.colors.neon} size={20} />
                <Text style={styles.modalTitle}>Cobrança Pix pronta</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar QR Code"
                hitSlop={10}
                onPress={() => setVisible(false)}
                style={styles.closeButton}>
                <X color={theme.colors.secondary} size={21} />
              </Pressable>
            </View>

            {charge && (
              <>
                <Text style={styles.amountCaption}>VALOR EXATO</Text>
                <Text style={styles.modalAmount}>R$ {formatCurrencyFromCents(charge.amountInCents)}</Text>
                <View style={styles.qrFrame}>
                  <QRCode
                    backgroundColor="#FFFFFF"
                    color="#000000"
                    ecl="H"
                    onError={(error: unknown) => {
                      console.error('[PixFala][qr] Falha ao renderizar QR Code', error);
                    }}
                    quietZone={16}
                    size={qrSize}
                    value={charge.brCode}
                  />
                </View>
                <Text style={styles.scanHint}>Peça ao cliente para escanear o código no app do banco.</Text>
              </>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={clearCharge}
              style={({ pressed }) => [styles.newChargeButton, pressed && styles.pressed]}>
              <RotateCcw color={theme.colors.black} size={18} />
              <Text style={styles.newChargeLabel}>Limpar / Nova cobrança</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 17,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  icon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#10291A',
  },
  headingCopy: { flex: 1, gap: 4 },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  subtitle: { color: theme.colors.secondary, fontSize: 10 },
  fieldLabel: { color: theme.colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 },
  amountField: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currencySymbol: { color: theme.colors.secondary, fontSize: 20, fontWeight: '700' },
  amountInput: { flex: 1, color: theme.colors.text, fontSize: 30, fontWeight: '800', paddingVertical: 0 },
  hint: { color: theme.colors.secondary, fontSize: 11, lineHeight: 16, marginTop: 10 },
  generateButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    borderRadius: 15,
    backgroundColor: theme.colors.neon,
  },
  disabledButton: { backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border },
  generateLabel: { color: theme.colors.black, fontSize: 14, fontWeight: '800' },
  disabledLabel: { color: theme.colors.muted },
  pressed: { opacity: 0.78 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  modalCard: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#275137',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceRaised,
  },
  amountCaption: { color: theme.colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 9 },
  modalAmount: { color: theme.colors.neon, fontSize: 34, fontWeight: '900', marginTop: 2, marginBottom: 14 },
  qrFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
  },
  scanHint: { color: theme.colors.secondary, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 13 },
  newChargeButton: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 17,
    borderRadius: 15,
    backgroundColor: theme.colors.neon,
  },
  newChargeLabel: { color: theme.colors.black, fontSize: 13, fontWeight: '800' },
});
