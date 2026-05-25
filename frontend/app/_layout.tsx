import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import OfflineGate from "@/components/OfflineGate";

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OfflineGate>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#09090B" },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="task/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="earn/spin" />
            <Stack.Screen name="earn/scratch" />
            <Stack.Screen name="earn/visit" />
            <Stack.Screen name="earn/watch" />
            <Stack.Screen name="earn/quiz" />
            <Stack.Screen name="earn/survey" />
            <Stack.Screen name="earn/checkin" />
            <Stack.Screen name="earn/refer" />
            <Stack.Screen name="withdraw" />
            <Stack.Screen name="admin-login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin/index" />
          </Stack>
        </OfflineGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
