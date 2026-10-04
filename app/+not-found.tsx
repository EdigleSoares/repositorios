import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Essa tela não existe.</Text>
        <Text style={styles.description}>Volte ao início para continuar usando o PixFala.</Text>
        <Link href="/" style={styles.link}>
          Voltar ao início
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  code: { color: theme.colors.neon, fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '700', marginTop: 10 },
  description: { color: theme.colors.secondary, fontSize: 13, textAlign: 'center', marginTop: 8 },
  link: {
    color: theme.colors.neon,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 22,
    padding: 12,
  },
});
