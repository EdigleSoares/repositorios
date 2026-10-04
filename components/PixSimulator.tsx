import { useState } from 'react';
import { AlertCircle, Check, Clock3, Play, UserRound, Volume2, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '@/constants/theme';
import { falarPix } from '@/services/ttsService';
import { formatarNomePagador, formatarValorMonetario } from '@/utils/pixFormatter';

type PixSimulation = {
  id: number;
  amount: string;
  payer: string;
  time: string;
};

type PixSimulatorProps = {
  active: boolean;
};

export function PixSimulator({ active }: PixSimulatorProps) {
  const [amount, setAmount] = useState('25,00');
  const [payer, setPayer] = useState('Cliente teste');
  const [simulations, setSimulations] = useState<PixSimulation[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const simulatePix = (withoutPayer = false) => {
    if (!active) {
      setFeedback({ type: 'error', message: 'Ative o PixFala antes de simular um recebimento.' });
      return;
    }

    const formattedAmount = withoutPayer ? '0,01' : formatarValorMonetario(amount);
    if (!formattedAmount) {
      setFeedback({ type: 'error', message: 'Digite um valor válido, como 25,00.' });
      return;
    }

    const formattedPayer = withoutPayer ? null : formatarNomePagador(payer);
    if (!withoutPayer && !formattedPayer) {
      setFeedback({ type: 'error', message: 'Digite o nome de quem enviou o Pix.' });
      return;
    }

    const speech = falarPix(formattedAmount, formattedPayer ?? undefined);
    setSimulations((current) =>
      [
        {
          id: Date.now(),
          amount: formattedAmount,
          payer: formattedPayer ?? 'Remetente não informado',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...current,
      ].slice(0, 5),
    );
    setFeedback({
      type: 'success',
      message: withoutPayer
        ? 'Notificação sem nome simulada. Anúncio de voz iniciado.'
        : 'Pix de teste registrado. Anúncio de voz iniciado.',
    });

    void speech.catch((error: unknown) => {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? `Pix registrado, mas não foi possível reproduzir a voz: ${error.message}`
            : 'Pix registrado, mas não foi possível reproduzir a voz.',
      });
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Play color={theme.colors.neon} size={15} fill={theme.colors.neon} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Simulador de Teste de Pix</Text>
          <Text style={styles.subtitle}>Experimente o anúncio de voz</Text>
        </View>
      </View>

      <Text style={styles.label}>VALOR DO PIX</Text>
      <View style={styles.inputWrapper}>
        <Text style={styles.currency}>R$</Text>
        <TextInput
          accessibilityLabel="Valor do Pix de teste"
          value={amount}
          onChangeText={setAmount}
          placeholder="25,00"
          placeholderTextColor={theme.colors.muted}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={20}
          style={styles.input}
        />
      </View>

      <Text style={styles.label}>NOME DE QUEM ENVIOU</Text>
      <View style={styles.inputWrapper}>
        <UserRound color={theme.colors.secondary} size={17} />
        <TextInput
          accessibilityLabel="Nome fictício de quem enviou o Pix"
          value={payer}
          onChangeText={setPayer}
          placeholder="Ex.: Maria Silva"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="words"
          returnKeyType="done"
          maxLength={60}
          style={styles.input}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !active }}
        disabled={!active}
        onPress={() => simulatePix()}
        style={({ pressed }) => [
          styles.submitButton,
          !active && styles.submitButtonDisabled,
          pressed && active && styles.pressed,
        ]}>
        <Volume2 color={active ? theme.colors.black : theme.colors.muted} size={17} />
        <Text style={[styles.submitText, !active && styles.submitTextDisabled]}>Simular Recebimento</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !active }}
        disabled={!active}
        onPress={() => simulatePix(true)}
        style={({ pressed }) => [
          styles.noNameButton,
          !active && styles.noNameButtonDisabled,
          pressed && active && styles.pressed,
        ]}>
        <Text style={[styles.noNameButtonText, !active && styles.submitTextDisabled]}>
          Simular notificação sem nome (R$ 0,01)
        </Text>
      </Pressable>

      {!active && (
        <Text style={styles.disabledHint}>Ative o status do PixFala para habilitar a simulação.</Text>
      )}

      {feedback && (
        <View style={[styles.feedback, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          {feedback.type === 'error' ? (
            <AlertCircle color="#FF7474" size={15} />
          ) : (
            <Check color={theme.colors.neon} size={15} />
          )}
          <Text style={[styles.feedbackText, feedback.type === 'error' && styles.feedbackTextError]}>
            {feedback.message}
          </Text>
        </View>
      )}

      <View style={styles.historyHeading}>
        <Text style={styles.historyTitle}>Testes recentes</Text>
        <Text style={styles.historyCount}>{simulations.length} / 5</Text>
      </View>

      {simulations.length === 0 ? (
        <View style={styles.emptyState}>
          <Wallet color={theme.colors.muted} size={18} />
          <Text style={styles.emptyText}>Seus Pix de teste vão aparecer aqui</Text>
        </View>
      ) : (
        simulations.map((simulation) => (
          <View key={simulation.id} style={styles.simulationRow}>
            <View style={styles.simulationIcon}>
              <Check color={theme.colors.neon} size={15} />
            </View>
            <View style={styles.simulationCopy}>
              <Text style={styles.simulationPayer}>{simulation.payer}</Text>
              <View style={styles.simulationTime}>
                <Clock3 color={theme.colors.muted} size={11} />
                <Text style={styles.simulationTimeText}>{simulation.time}</Text>
              </View>
            </View>
            <Text style={styles.simulationAmount}>R$ {simulation.amount}</Text>
          </View>
        ))
      )}
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
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 19 },
  headingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10291A',
  },
  headingCopy: { flex: 1 },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  subtitle: { color: theme.colors.secondary, fontSize: 11, marginTop: 4 },
  label: { color: theme.colors.secondary, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 7 },
  inputWrapper: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    marginBottom: 14,
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currency: { color: theme.colors.secondary, fontSize: 13, fontWeight: '600' },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, color: theme.colors.text, fontSize: 14 },
  submitButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 2,
    borderRadius: 14,
    backgroundColor: theme.colors.neon,
  },
  submitButtonDisabled: { backgroundColor: '#292E35' },
  submitText: { color: theme.colors.black, fontSize: 12, fontWeight: '800' },
  submitTextDisabled: { color: theme.colors.muted },
  noNameButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
    borderRadius: 13,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  noNameButtonDisabled: { backgroundColor: theme.colors.surfaceRaised },
  noNameButtonText: { color: theme.colors.secondary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabledHint: { color: theme.colors.muted, fontSize: 10, textAlign: 'center', marginTop: 9 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    marginTop: 11,
    borderRadius: 12,
  },
  feedbackError: { backgroundColor: '#301A1D' },
  feedbackSuccess: { backgroundColor: '#10291A' },
  feedbackText: { flex: 1, color: theme.colors.neon, fontSize: 10, lineHeight: 15 },
  feedbackTextError: { color: '#FF9A9A' },
  historyHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 19,
    marginBottom: 9,
  },
  historyTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  historyCount: { color: theme.colors.muted, fontSize: 10, fontWeight: '600' },
  emptyState: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceRaised,
  },
  emptyText: { color: theme.colors.muted, fontSize: 10 },
  simulationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  simulationIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#10291A',
  },
  simulationCopy: { flex: 1 },
  simulationPayer: { color: theme.colors.text, fontSize: 11, fontWeight: '600' },
  simulationTime: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  simulationTimeText: { color: theme.colors.muted, fontSize: 9 },
  simulationAmount: { color: theme.colors.neon, fontSize: 11, fontWeight: '700' },
});
