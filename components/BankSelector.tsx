import { useState } from 'react';
import { Check, ChevronDown, Info, X } from 'lucide-react-native';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '@/constants/theme';

const banks = [
  { name: 'Nubank', monogram: 'nu', color: '#8A05BE' },
  { name: 'Itaú', monogram: 'itaú', color: '#EC7000' },
  { name: 'Bradesco', monogram: 'b', color: '#CC092F' },
  { name: 'Banco do Brasil', monogram: 'bb', color: '#F8D117', textColor: '#173D80' },
  { name: 'Mercado Pago', monogram: 'mp', color: '#009EE3' },
  { name: 'Caixa', monogram: 'cx', color: '#0066B3' },
  { name: 'Inter', monogram: 'in', color: '#FF7A00' },
  { name: 'PagBank', monogram: 'p', color: '#13A867' },
];

export function BankSelector() {
  const [selectedBank, setSelectedBank] = useState(banks[0]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.heading}>
          <View>
            <Text style={styles.eyebrow}>BANCO PARA PIX</Text>
            <Text style={styles.subtitle}>Escolha sua instituição</Text>
          </View>
          <View accessibilityLabel="Informação sobre a seleção de banco" style={styles.infoButton}>
            <Info color={theme.colors.secondary} size={17} />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Selecionar banco, atual ${selectedBank.name}`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.selector, pressed && styles.pressed]}>
          <View style={[styles.bankMark, { backgroundColor: selectedBank.color }]}>
            <Text style={[styles.bankMonogram, selectedBank.textColor && { color: selectedBank.textColor }]}>
              {selectedBank.monogram}
            </Text>
          </View>
          <View style={styles.bankCopy}>
            <Text style={styles.bankName}>{selectedBank.name}</Text>
            <Text style={styles.bankCaption}>Banco selecionado</Text>
          </View>
          <ChevronDown color={theme.colors.secondary} size={20} />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeading}>
              <View>
                <Text style={styles.sheetTitle}>Selecione seu banco</Text>
                <Text style={styles.sheetCaption}>Escolha de onde chegam seus Pix</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar seleção de banco"
                onPress={() => setOpen(false)}
                style={styles.closeButton}>
                <X color={theme.colors.secondary} size={19} />
              </Pressable>
            </View>

            {banks.map((bank) => {
              const selected = bank.name === selectedBank.name;
              return (
                <Pressable
                  key={bank.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSelectedBank(bank);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.bankOption,
                    selected && styles.bankOptionSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.bankMark, { backgroundColor: bank.color }]}>
                    <Text style={[styles.bankMonogram, bank.textColor && { color: bank.textColor }]}>
                      {bank.monogram}
                    </Text>
                  </View>
                  <Text style={styles.optionName}>{bank.name}</Text>
                  {selected && <Check color={theme.colors.neon} size={18} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    padding: 13,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bankMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankMonogram: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bankCopy: {
    flex: 1,
    marginLeft: 12,
  },
  bankName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  bankCaption: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.78,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  sheet: {
    padding: 22,
    paddingBottom: 34,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 17,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetCaption: {
    color: theme.colors.secondary,
    fontSize: 12,
    marginTop: 5,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginTop: 6,
  },
  bankOptionSelected: {
    backgroundColor: '#10291A',
  },
  optionName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
