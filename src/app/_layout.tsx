import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBack } from '@/components/header-back';
import { RestTimerProvider } from '@/components/rest-timer';
import { SheetProvider } from '@/components/sheet';
import { AppThemeProvider } from '@/components/theme-provider';
import { Font } from '@/constants/theme';
import { migrateDb } from '@/db/migrate';
import { useTheme } from '@/hooks/use-theme';
import { syncReminders } from '@/lib/reminder-io';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#030F17' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#030F17' }}>
      <SQLiteProvider databaseName="gymcime.db" onInit={migrateDb}>
        <AppThemeProvider>
          <Navigation />
        </AppThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

/** Açılışta hatırlatıcı bildirimlerini ayarlara göre yeniden kurar (idempotent). */
function ReminderBoot() {
  const db = useSQLiteContext();
  useEffect(() => {
    syncReminders(db);
  }, [db]);
  return null;
}

function Navigation() {
  const t = useTheme();
  const base = t.isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: t.primary, background: t.background, card: t.background, text: t.text, border: t.border },
  };

  return (
    <ThemeProvider value={navTheme}>
      <RestTimerProvider>
        <SheetProvider>
          <StatusBar style={t.isDark ? 'light' : 'dark'} />
          <ReminderBoot />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: t.background },
              headerTintColor: t.primary,
              headerTitleStyle: { color: t.text, fontFamily: Font.bold },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: t.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="workout/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="summary/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen
              name="exercise-picker"
              options={{
                presentation: 'modal',
                headerShown: false,
                contentStyle: { backgroundColor: t.surface },
              }}
            />
            <Stack.Screen name="exercises" options={{ title: 'Egzersizler', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="exercise/[id]" options={{ title: '', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="routine/[id]" options={{ title: 'Rutin', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="session/[id]" options={{ title: '', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="body" options={{ title: 'Vücut analizi', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="food/add" options={{ title: 'Yiyecek ekle', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="week-plan" options={{ title: 'Haftalık plan', headerLeft: () => <HeaderBack /> }} />
            <Stack.Screen name="settings" options={{ title: 'Ayarlar', headerLeft: () => <HeaderBack /> }} />
          </Stack>
        </SheetProvider>
      </RestTimerProvider>
    </ThemeProvider>
  );
}
