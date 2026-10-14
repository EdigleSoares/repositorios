import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, ChevronUp, LockKeyhole, Minus, Pencil, Plus, Trash2, Volume2 } from 'lucide-react-native';

import { PixChargeSettings } from '@/components/PixChargeSettings';
import { theme } from '@/constants/theme';
import {
  deleteSavedProduct,
  getSavedProducts,
  saveProduct,
  type SavedProduct,
} from '@/services/savedProductsService';
import {
  DEFAULT_SPEECH_TEMPLATE,
  getSpeechSettings,
  saveSpeechSettings,
  SPEECH_RATES,
  type SpeechRate,
} from '@/services/speechSettingsService';
import { getPixChargeConfig, type PixChargeConfig } from '@/services/pixChargeService';
import { testarMensagemVoz } from '@/services/ttsService';

const MAX_PRODUCT_PRICE_CENTS = 999_999_999_999;

function formatCurrencyFromCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePrice(value: string): { cents: number | null; display: string } {
  const digits = value.replace(/\D/gu, '').slice(0, 12);
  if (!digits) return { cents: null, display: '' };
  const cents = Math.min(Number(digits), MAX_PRODUCT_PRICE_CENTS);
  return { cents, display: formatCurrencyFromCents(cents) };
}

export default function SettingsScreen() {
  const [pixChargeConfig, setPixChargeConfig] = useState<PixChargeConfig | null>(null);
  const [speechTemplate, setSpeechTemplate] = useState(DEFAULT_SPEECH_TEMPLATE);
  const [speechRate, setSpeechRate] = useState<SpeechRate>(1);
  const [speechVolume, setSpeechVolume] = useState(1);
  const [savedSpeechTemplate, setSavedSpeechTemplate] = useState(DEFAULT_SPEECH_TEMPLATE);
  const [savedSpeechRate, setSavedSpeechRate] = useState<SpeechRate>(1);
  const [savedSpeechVolume, setSavedSpeechVolume] = useState(1);
  const [speechLoaded, setSpeechLoaded] = useState(false);
  const [savingSpeech, setSavingSpeech] = useState(false);
  const [testingSpeech, setTestingSpeech] = useState(false);
  const [speechExpanded, setSpeechExpanded] = useState(false);
  const [speechEditing, setSpeechEditing] = useState(false);
  const [selection, setSelection] = useState({ start: speechTemplate.length, end: speechTemplate.length });
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productPriceInCents, setProductPriceInCents] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMessage, setProductMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    void getPixChargeConfig()
      .then((config) => {
        if (mounted) setPixChargeConfig(config);
      })
      .catch((error: unknown) => {
        if (mounted) {
          Alert.alert(
            'Chave Pix',
            error instanceof Error ? error.message : 'Não foi possível carregar a chave Pix.',
          );
        }
      });
    void getSpeechSettings()
      .then((settings) => {
        if (mounted) {
          setSpeechTemplate(settings.template);
          setSavedSpeechTemplate(settings.template);
          setSelection({ start: settings.template.length, end: settings.template.length });
          setSpeechRate(settings.rate);
          setSavedSpeechRate(settings.rate);
          setSpeechVolume(settings.volume);
          setSavedSpeechVolume(settings.volume);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          Alert.alert(
            'Configuração da voz',
            error instanceof Error ? error.message : 'Não foi possível carregar as configurações de voz.',
          );
        }
      })
      .finally(() => {
        if (mounted) setSpeechLoaded(true);
      });
    void getSavedProducts()
      .then((savedProducts) => {
        if (mounted) setProducts(savedProducts);
      })
      .catch((error: unknown) => {
        if (mounted) {
          Alert.alert(
            'Produtos salvos',
            error instanceof Error ? error.message : 'Não foi possível carregar os produtos.',
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const insertVariable = (variable: '{nome}' | '{sobrenome}' | '{valor}') => {
    const start = Math.min(selection.start, speechTemplate.length);
    const end = Math.min(selection.end, speechTemplate.length);
    const nextTemplate = `${speechTemplate.slice(0, start)}${variable}${speechTemplate.slice(end)}`;
    const cursor = start + variable.length;
    setSpeechTemplate(nextTemplate);
    setSelection({ start: cursor, end: cursor });
  };

  const handleSaveSpeech = async () => {
    if (!speechLoaded || savingSpeech) return;
    setSavingSpeech(true);
    try {
      const savedSettings = await saveSpeechSettings({
        template: speechTemplate,
        rate: speechRate,
        volume: speechVolume,
      });
      setSpeechTemplate(savedSettings.template);
      setSavedSpeechTemplate(savedSettings.template);
      setSavedSpeechRate(savedSettings.rate);
      setSavedSpeechVolume(savedSettings.volume);
      setSpeechEditing(false);
      setSpeechExpanded(false);
      Alert.alert('Voz atualizada', 'A frase e a velocidade serão usadas no próximo Pix recebido.');
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Confira a frase e tente novamente.',
      );
    } finally {
      setSavingSpeech(false);
    }
  };

  const handleEditSpeech = () => {
    setSpeechEditing(true);
    setSpeechExpanded(true);
  };

  const handleCancelSpeechEdit = () => {
    setSpeechTemplate(savedSpeechTemplate);
    setSpeechRate(savedSpeechRate);
    setSpeechVolume(savedSpeechVolume);
    setSelection({ start: savedSpeechTemplate.length, end: savedSpeechTemplate.length });
    setSpeechEditing(false);
  };

  const handleTestSpeech = async () => {
    if (!speechLoaded || savingSpeech || testingSpeech) return;
    setTestingSpeech(true);
    try {
      await testarMensagemVoz(speechTemplate, speechRate, speechVolume);
    } catch (error) {
      Alert.alert(
        'Não foi possível testar a voz',
        error instanceof Error ? error.message : 'Confira a frase e tente novamente.',
      );
    } finally {
      setTestingSpeech(false);
    }
  };

  const adjustSpeechVolume = (delta: number) => {
    setSpeechVolume((volume) =>
      Math.min(1, Math.max(0, Math.round((volume + delta) * 10) / 10)),
    );
  };

  const resetProductForm = () => {
    setProductName('');
    setProductPrice('');
    setProductPriceInCents(null);
    setEditingProductId(null);
  };

  const handleSaveProduct = async () => {
    const normalizedName = productName.trim();
    if (!normalizedName) {
      Alert.alert('Nome do produto', 'Informe o nome do produto.');
      return;
    }
    if (normalizedName.length > 50) {
      Alert.alert('Nome do produto', 'Use no máximo 50 caracteres.');
      return;
    }
    if (!productPriceInCents || productPriceInCents <= 0) {
      Alert.alert('Preço do produto', 'Informe um preço maior que R$ 0,00.');
      return;
    }

    setSavingProduct(true);
    try {
      const id = editingProductId ?? `product-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const updatedProducts = await saveProduct({
        id,
        name: normalizedName,
        priceInCents: productPriceInCents,
      });
      setProducts(updatedProducts);
      setProductMessage(editingProductId ? 'Produto atualizado.' : 'Produto salvo.');
      resetProductForm();
      setProductsExpanded(false);
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar o produto',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEditProduct = (product: SavedProduct) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductPrice(formatCurrencyFromCents(product.priceInCents));
    setProductPriceInCents(product.priceInCents);
    setProductMessage('');
  };

  const handleDeleteProduct = (product: SavedProduct) => {
    Alert.alert('Excluir produto?', `${product.name} será removido dos atalhos de cobrança.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void deleteSavedProduct(product.id)
            .then((updatedProducts) => {
              setProducts(updatedProducts);
              if (editingProductId === product.id) resetProductForm();
            })
            .catch((error: unknown) => {
              Alert.alert(
                'Não foi possível excluir',
                error instanceof Error ? error.message : 'Tente novamente.',
              );
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SEU PIX FALA DO SEU JEITO</Text>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>Configure o Pix, a voz e os produtos das suas cobranças.</Text>

        <Text style={styles.sectionTitle}>Chave Pix</Text>
        <PixChargeSettings config={pixChargeConfig} onSaved={setPixChargeConfig} />

        <Text style={styles.sectionTitle}>Mensagem de voz</Text>
        <View style={styles.card}>
          <View style={styles.speechHeading}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: speechExpanded }}
              onPress={() => setSpeechExpanded((expanded) => !expanded)}
              style={({ pressed }) => [styles.speechHeadingToggle, pressed && styles.pressed]}>
              <View style={styles.icon}>
                <Volume2 color={theme.colors.neon} size={18} />
              </View>
              <View style={styles.cardHeadingCopy}>
                <Text style={styles.cardTitle}>Frase do anúncio</Text>
                <Text style={styles.cardSubtitle}>
                  {speechTemplate === DEFAULT_SPEECH_TEMPLATE
                    ? `Padrão • ${speechRate.toLocaleString('pt-BR')}x • ${Math.round(speechVolume * 100)}%`
                    : `Personalizada • ${speechRate.toLocaleString('pt-BR')}x • ${Math.round(speechVolume * 100)}%`}
                </Text>
              </View>
              {speechExpanded
                ? <ChevronUp color={theme.colors.secondary} size={19} />
                : <ChevronDown color={theme.colors.secondary} size={19} />}
            </Pressable>
          </View>

          {speechExpanded && (
            <View style={styles.speechContent}>
              {!speechEditing ? (
                <>
                  <View style={styles.lockedSpeechSummary}>
                    <View style={styles.lockedSpeechCopy}>
                      <Text style={styles.fieldLabel}>MENSAGEM ATUAL</Text>
                      <Text style={styles.lockedSpeechText}>{speechTemplate}</Text>
                      <Text style={styles.helper}>
                        Velocidade: {speechRate.toLocaleString('pt-BR')}x • Volume: {Math.round(speechVolume * 100)}%
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Editar mensagem de voz"
                      disabled={!speechLoaded}
                      onPress={handleEditSpeech}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      <Pencil color={theme.colors.neon} size={17} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.variableRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Inserir primeiro nome"
                      disabled={!speechLoaded}
                      onPress={() => insertVariable('{nome}')}
                      style={({ pressed }) => [styles.variableButton, pressed && styles.pressed]}>
                      <Plus color={theme.colors.neon} size={14} />
                      <Text style={styles.variableLabel}>Nome</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Inserir sobrenome"
                      disabled={!speechLoaded}
                      onPress={() => insertVariable('{sobrenome}')}
                      style={({ pressed }) => [styles.variableButton, pressed && styles.pressed]}>
                      <Plus color={theme.colors.neon} size={14} />
                      <Text style={styles.variableLabel}>Sobrenome</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Inserir valor recebido"
                      disabled={!speechLoaded}
                      onPress={() => insertVariable('{valor}')}
                      style={({ pressed }) => [styles.variableButton, pressed && styles.pressed]}>
                      <Plus color={theme.colors.neon} size={14} />
                      <Text style={styles.variableLabel}>Valor</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    accessibilityLabel="Mensagem personalizada para anunciar o Pix"
                    editable={speechLoaded && !savingSpeech && speechEditing}
                    maxLength={180}
                    multiline
                    onChangeText={setSpeechTemplate}
                    onSelectionChange={({ nativeEvent }) => setSelection(nativeEvent.selection)}
                    placeholder="Ex.: Pix de {valor} recebido de {nome}. Obrigado!"
                    placeholderTextColor={theme.colors.muted}
                    selection={selection}
                    style={styles.messageInput}
                    textAlignVertical="top"
                    value={speechTemplate}
                  />
                  <Text style={styles.helper}>
                    Use apenas as variáveis desejadas: {'{nome}'} para o primeiro nome, {'{sobrenome}'} para o sobrenome e {'{valor}'} para o valor. Você também pode omitir nome e sobrenome. Até 180 caracteres.
                  </Text>

                  <Text style={styles.fieldLabel}>VELOCIDADE DA FALA</Text>
                  <View style={styles.rateRow}>
                    {SPEECH_RATES.map((rate) => {
                      const selected = speechRate === rate;
                      const label = rate === 1 ? '1x' : `${rate.toLocaleString('pt-BR')}x`;
                      return (
                        <Pressable
                          key={rate}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          disabled={!speechLoaded || !speechEditing}
                          onPress={() => setSpeechRate(rate)}
                          style={({ pressed }) => [
                            styles.rateOption,
                            selected && styles.rateOptionSelected,
                            pressed && styles.pressed,
                          ]}>
                          <Text style={[styles.rateLabel, selected && styles.rateLabelSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>VOLUME DA VOZ</Text>
                  <View style={styles.volumeControl}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Diminuir volume da voz"
                      accessibilityState={{ disabled: !speechLoaded || !speechEditing || speechVolume <= 0 }}
                      disabled={!speechLoaded || !speechEditing || speechVolume <= 0}
                      onPress={() => adjustSpeechVolume(-0.1)}
                      style={({ pressed }) => [
                        styles.volumeButton,
                        (!speechLoaded || !speechEditing || speechVolume <= 0) && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}>
                      <Minus color={theme.colors.text} size={18} />
                    </Pressable>
                    <View style={styles.volumeMeter}>
                      <View style={styles.volumeMeterLabels}>
                        <Volume2 color={theme.colors.neon} size={17} />
                        <Text style={styles.volumeValue}>{Math.round(speechVolume * 100)}%</Text>
                      </View>
                      <View
                        accessibilityLabel={`Volume da voz ${Math.round(speechVolume * 100)} por cento`}
                        accessibilityRole="progressbar"
                        accessibilityValue={{ min: 0, max: 100, now: Math.round(speechVolume * 100) }}
                        style={styles.volumeTrack}>
                        <View style={[styles.volumeFill, { width: `${speechVolume * 100}%` }]} />
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Aumentar volume da voz"
                      accessibilityState={{ disabled: !speechLoaded || !speechEditing || speechVolume >= 1 }}
                      disabled={!speechLoaded || !speechEditing || speechVolume >= 1}
                      onPress={() => adjustSpeechVolume(0.1)}
                      style={({ pressed }) => [
                        styles.volumeButton,
                        (!speechLoaded || !speechEditing || speechVolume >= 1) && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}>
                      <Plus color={theme.colors.neon} size={18} />
                    </Pressable>
                  </View>
                  <Text style={styles.helper}>
                    Ajusta apenas o volume da fala do PixFala, sem alterar o volume geral do celular.
                  </Text>

                  <View style={styles.speechEditActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={savingSpeech || testingSpeech}
                      onPress={handleCancelSpeechEdit}
                      style={({ pressed }) => [
                        styles.speechCancelButton,
                        (savingSpeech || testingSpeech) && styles.disabledButton,
                        pressed && !savingSpeech && !testingSpeech && styles.pressed,
                      ]}>
                      <LockKeyhole color={theme.colors.secondary} size={16} />
                      <Text style={styles.secondaryButtonLabel}>Cancelar edição</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!speechLoaded || savingSpeech || testingSpeech}
                      onPress={() => void handleSaveSpeech()}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        styles.speechSaveButton,
                        (!speechLoaded || savingSpeech || testingSpeech) && styles.disabledButton,
                        pressed && speechLoaded && !savingSpeech && !testingSpeech && styles.pressed,
                      ]}>
                      <Check color={theme.colors.black} size={17} strokeWidth={2.5} />
                      <Text style={styles.primaryButtonLabel}>
                        {savingSpeech ? 'Salvando...' : 'Salvar voz'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Testar áudio da mensagem"
            disabled={!speechLoaded || savingSpeech || testingSpeech}
            onPress={() => void handleTestSpeech()}
            style={({ pressed }) => [
              styles.speechTestButton,
              (!speechLoaded || savingSpeech || testingSpeech) && styles.disabledButton,
              pressed && speechLoaded && !savingSpeech && !testingSpeech && styles.pressed,
            ]}>
            <Volume2 color={theme.colors.neon} size={17} />
            <Text style={styles.speechTestLabel}>
              {testingSpeech ? 'Reproduzindo mensagem...' : 'Testar áudio'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Produtos</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: productsExpanded }}
            onPress={() => setProductsExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.cardHeading, pressed && styles.pressed]}>
            <View style={styles.icon}>
              <Plus color={theme.colors.neon} size={18} />
            </View>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.cardTitle}>Atalhos de produtos</Text>
              <Text style={styles.cardSubtitle}>
                {products.length > 0
                  ? `${products.length} salvos • usados para somar cobranças`
                  : 'Cadastre produtos para agilizar o QR'}
              </Text>
            </View>
            {productsExpanded
              ? <ChevronUp color={theme.colors.secondary} size={19} />
              : <ChevronDown color={theme.colors.secondary} size={19} />}
          </Pressable>
          {productsExpanded && (
            <>
          <Text style={styles.cardTitle}>
            {editingProductId ? 'Editar produto' : 'Novo produto'}
          </Text>
          <Text style={styles.cardSubtitle}>
            Informe nome e preço. Eles viram atalhos na tela inicial.
          </Text>
          <Text style={styles.fieldLabel}>NOME</Text>
          <TextInput
            accessibilityLabel="Nome do produto"
            autoCapitalize="sentences"
            maxLength={50}
            onChangeText={setProductName}
            placeholder="Ex.: X-Burguer"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            value={productName}
          />
          <Text style={styles.fieldLabel}>PREÇO UNITÁRIO</Text>
          <View style={styles.priceField}>
            <Text style={styles.currencySymbol}>R$</Text>
            <TextInput
              accessibilityLabel="Preço do produto"
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                const parsed = parsePrice(value);
                setProductPrice(parsed.display);
                setProductPriceInCents(parsed.cents);
              }}
              placeholder="0,00"
              placeholderTextColor={theme.colors.muted}
              returnKeyType="done"
              selectTextOnFocus
              style={styles.priceInput}
              value={productPrice}
            />
          </View>
          <View style={styles.formActions}>
            {editingProductId && (
              <Pressable
                accessibilityRole="button"
                onPress={resetProductForm}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryLabel}>Cancelar</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={savingProduct}
              onPress={() => void handleSaveProduct()}
              style={({ pressed }) => [
                styles.primaryButton,
                savingProduct && styles.disabledButton,
                pressed && !savingProduct && styles.pressed,
              ]}>
              <Check color={theme.colors.black} size={16} />
              <Text style={styles.primaryButtonLabel}>
                {savingProduct ? 'Salvando...' : editingProductId ? 'Salvar alterações' : 'Salvar produto'}
              </Text>
            </Pressable>
          </View>
          {productMessage ? <Text style={styles.successMessage}>{productMessage}</Text> : null}

          {products.length > 0 ? (
            <View style={styles.savedProducts}>
              <Text style={styles.fieldLabel}>PRODUTOS SALVOS</Text>
              {products.map((product) => (
                <View key={product.id} style={styles.savedProductRow}>
                  <View style={styles.productCopy}>
                    <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                    <Text style={styles.cardSubtitle}>R$ {formatCurrencyFromCents(product.priceInCents)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${product.name}`}
                    onPress={() => handleEditProduct(product)}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                    <Pencil color={theme.colors.neon} size={16} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${product.name}`}
                    onPress={() => handleDeleteProduct(product)}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                    <Trash2 color={theme.colors.secondary} size={16} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>Nenhum produto salvo.</Text>
          )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 22, paddingTop: 23, paddingBottom: 32 },
  eyebrow: { color: theme.colors.neon, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.8, marginTop: 7 },
  subtitle: { color: theme.colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 23, marginBottom: 10 },
  card: {
    padding: 16,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 15 },
  icon: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#10291A',
  },
  cardHeadingCopy: { flex: 1, gap: 4 },
  cardTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  cardSubtitle: { color: theme.colors.secondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  lockedSpeechSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockedSpeechCopy: { flex: 1 },
  lockedSpeechText: { color: theme.colors.text, fontSize: 12, lineHeight: 18, marginTop: 2 },
  speechEditActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  speechCancelButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  speechSaveButton: { flex: 1 },
  secondaryButtonLabel: { color: theme.colors.secondary, fontSize: 10, fontWeight: '700' },
  speechHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  speechHeadingToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  speechContent: { marginTop: 12 },
  variableRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  variableButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: '#275137',
  },
  variableLabel: { color: theme.colors.neon, fontSize: 9, fontWeight: '700', flexShrink: 1 },
  messageInput: {
    minHeight: 96,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.black,
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  helper: { color: theme.colors.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  fieldLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  rateRow: { flexDirection: 'row', gap: 8 },
  rateOption: {
    flex: 1,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rateOptionSelected: { borderColor: theme.colors.neon, backgroundColor: '#10291A' },
  rateLabel: { color: theme.colors.secondary, fontSize: 12, fontWeight: '700' },
  rateLabelSelected: { color: theme.colors.neon },
  volumeControl: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  volumeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceRaised,
  },
  volumeMeter: { flex: 1, gap: 7 },
  volumeMeterLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeValue: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  volumeTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceRaised,
  },
  volumeFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.neon,
  },
  speechTestButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: '#275137',
  },
  speechTestLabel: { color: theme.colors.neon, fontSize: 11, fontWeight: '800' },
  primaryButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor: theme.colors.neon,
  },
  disabledButton: { opacity: 0.55 },
  primaryButtonLabel: { color: theme.colors.black, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  input: {
    minHeight: 47,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.black,
    color: theme.colors.text,
    fontSize: 12,
  },
  priceField: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.black,
  },
  currencySymbol: { color: theme.colors.secondary, fontSize: 15, fontWeight: '700' },
  priceInput: { flex: 1, color: theme.colors.text, fontSize: 19, fontWeight: '700', paddingVertical: 0 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 13 },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryLabel: { color: theme.colors.secondary, fontSize: 10, fontWeight: '700' },
  successMessage: { color: theme.colors.neon, fontSize: 10, marginTop: 9 },
  savedProducts: { gap: 7, marginTop: 8 },
  savedProductRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: 12,
    backgroundColor: theme.colors.black,
  },
  productCopy: { flex: 1 },
  productName: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceRaised,
  },
  emptyHint: { color: theme.colors.muted, fontSize: 10, marginTop: 16 },
});
