import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type StatusToggleProps = {
  active: boolean;
  onToggle: () => void;
};

export function StatusToggle({ active, onToggle }: StatusToggleProps) {
  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.controlRow}>
        <View style={styles.statusCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{active ? 'PixFala ligado' : 'PixFala pausado'}</Text>
            <View style={[styles.statusBadge, active ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
              <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
                {active ? 'ATIVO' : 'PAUSADO'}
              </Text>
            </View>
          </View>
          <Text style={styles.caption}>
            {active ? 'Anuncia cada novo Pix recebido' : 'Ative para ouvir seus Pix'}
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
            {active && <Check color={theme.colors.black} size={15} strokeWidth={3} />}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardActive: {
    borderColor: '#14552F',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    fontSize: 9,
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
    gap: 10,
  },
  statusCopy: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  caption: {
    color: theme.colors.secondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  switchTrack: {
    width: 56,
    height: 32,
    borderRadius: theme.radius.pill,
    padding: 3,
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
    width: 26,
    height: 26,
    borderRadius: 13,
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
});
