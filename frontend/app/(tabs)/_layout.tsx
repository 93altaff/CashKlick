import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Home, Zap, Wallet, User } from 'lucide-react-native';
import { View, Pressable, GestureResponderEvent } from 'react-native';
import { COLORS } from '../../src/theme';
import AdBanner from '../../components/AdBanner';

const TAB_BAR_HEIGHT = 64;

export default function TabsLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textDisabled,
          tabBarStyle: {
            backgroundColor: '#0f0f11',
            borderTopColor: COLORS.border,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="earn"
          options={{ title: 'Earn', tabBarIcon: ({ color, size }) => <Zap color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="wallet"
          options={{ title: 'Wallet', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
            tabBarButton: (props) => (
              <Pressable
                testID="profile-tab-btn"
                onPress={(e: GestureResponderEvent) => props.onPress?.(e as any)}
                onLongPress={() => router.push('/admin-login')}
                delayLongPress={600}
                android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: true }}
                style={({ pressed }) => [
                  { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
                  props.style as any,
                ]}
              >
                {props.children as any}
              </Pressable>
            ),
          }}
        />
      </Tabs>
      {/* Banner overlays just above the tab bar so it sits between content and tabs. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_HEIGHT }}
      >
        <AdBanner />
      </View>
    </View>
  );
}
