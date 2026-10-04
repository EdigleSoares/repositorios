import { Tabs } from 'expo-router';
import { FileText, Home, Rocket } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
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
        name="turbine"
        options={{
          title: 'Turbine seu Negócio',
          tabBarLabelStyle: { fontSize: 9, fontWeight: '700', marginTop: 3 },
          tabBarIcon: ({ size }) => <Rocket color={theme.colors.neon} size={size} strokeWidth={2.2} />,
        }}
      />
    </Tabs>
  );
}
