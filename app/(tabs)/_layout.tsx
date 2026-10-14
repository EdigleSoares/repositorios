import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Tabs } from 'expo-router';
import { FileText, Home, Rocket, Settings2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LicenseGate } from '@/components/LicenseGate';
import { theme } from '@/constants/theme';

function TurbineTabIcon({ size }: { size: number }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) }],
      }}>
      <Rocket color={theme.colors.neon} size={size} strokeWidth={2.2} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <LicenseGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.neon,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarStyle: {
            height: 76 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 3,
          },
          tabBarItemStyle: {
            paddingHorizontal: 2,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size, focused }) => (
              <Home color={focused ? theme.colors.neon : color} size={size} strokeWidth={focused ? 2.4 : 1.8} />
            ),
          }}
        />
        <Tabs.Screen
          name="relatorio"
          options={{
            title: 'Relatório',
            tabBarIcon: ({ color, size }) => <FileText color={color} size={size} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="configuracoes"
          options={{
            title: 'Ajustes',
            tabBarIcon: ({ color, size }) => <Settings2 color={color} size={size} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="turbine"
          options={{
            title: 'Turbine seu Negócio',
            tabBarLabelStyle: { fontSize: 9, fontWeight: '700', marginTop: 3 },
            tabBarIcon: ({ size }) => <TurbineTabIcon size={size} />,
          }}
        />
      </Tabs>
    </LicenseGate>
  );
}
