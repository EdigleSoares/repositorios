import { Check, Volume2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type StatusToggleProps = {
  active: boolean;
  onToggle: () => void;
};

export function StatusToggle({ active, onToggle }: StatusToggleProps) {
  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>STATUS</Text>
        <View style={[styles.statusBadge, active ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
          <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotInactive]} />
          <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
            {active ? 'ATIVO' : 'PAUSADO'}
          </Text>
        </View>
      </View>

      <View style={styles.controlRow}>
        <View style={styles.statusCopy}>
          <Text style={styles.title}>{active ? 'PixFala ligado' : 'PixFala pausado'}</Text>
          <Text style={styles.caption}>
            {active ? 'Seus pagamentos serão anunciados' : 'Ative para ouvir seus Pix'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Ativar anúncios de Pix"
          accessibilityState={{ checked: active }}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.switchTrack,
            active ? styles.switchTrackActive : styles.switchTrackInactive,
            active && styles.switchGlow,
            pressed && styles.pressed,
          ]}>
          <View style={[styles.switchThumb, active ? styles.switchThumbActive : styles.switchThumbInactive]}>
            {active && <Check color={theme.colors.black} size={18} strokeWidth={3} />}
          </View>
        </Pressable>
      </View>

      <View style={styles.divider} />
      <View style={styles.footer}>
        <Volume2 color={active ? theme.colors.neon : theme.colors.muted} size={16} />
        <Text style={styles.footerText}>
          {active ? 'Pronto para anunciar cada novo Pix' : 'Você pode ativar novamente quando quiser'}
        </Text>
      </View>
    </View>
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
  cardActive: {
    borderColor: '#14552F',
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  statusBadgeActive: {
    backgroundColor: '#10291A',
  },
  statusBadgeInactive: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: theme.colors.neon,
  },
  statusDotInactive: {
    backgroundColor: theme.colors.muted,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusTextActive: {
    color: theme.colors.neon,
  },
  statusTextInactive: {
    color: theme.colors.secondary,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 14,
  },
  statusCopy: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  caption: {
    color: theme.colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  switchTrack: {
    width: 68,
    height: 38,
    borderRadius: theme.radius.pill,
    padding: 4,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: theme.colors.neon,
  },
  switchTrackInactive: {
    backgroundColor: '#343A44',
  },
  switchGlow: {
    shadowColor: theme.colors.neon,
    shadowOpacity: 0.68,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  switchThumb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#F6FFF8',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
    backgroundColor: '#A2A9B2',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginTop: 20,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: theme.colors.secondary,
    fontSize: 11,
    flexShrink: 1,
  },
});
