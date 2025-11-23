import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { RegistroProvider } from '@/src/context/RegistroContext';
import { auth } from '@/src/services/firebase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (checkingAuth || isLoggedIn === null) return;
    const inTabs = segments[0] === '(tabs)';
    if (!isLoggedIn && inTabs) {
      router.replace('/');
    }
    if (isLoggedIn && !inTabs && segments.length === 0) {
      router.replace('/(tabs)');
    }
  }, [checkingAuth, isLoggedIn, segments, router]);

  return (
    <RegistroProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen
          name="create"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="chat/[conversationId]"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="register/index"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      <Stack.Screen
        name="register/conocimiento"
        options={{
          headerShown: false,
          presentation: 'card',
          }}
        />
        <Stack.Screen
          name="register/etiquetas"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
        name="register/intereses"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
          name="register/foto"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="forgot"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      <Stack.Screen
        name="profile/[userId]"
        options={{
          headerShown: true,
          title: 'Perfil',
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
    </RegistroProvider>
  );
}
