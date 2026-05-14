import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { getLanguage } from '../src/lib/auth-store';

export default function RootLayout() {
  const { session, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [langChecked, setLangChecked] = useState(false);
  const [hasLanguage, setHasLanguage] = useState(false);

  useEffect(() => {
    getLanguage().then(lang => {
      setHasLanguage(Boolean(lang));
      setLangChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!initialized || !langChecked) return;

    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';

    if (session) {
      // Only redirect away from auth screens; other app screens (e.g. person detail) are fine
      if (inAuth) router.replace('/(tabs)');
    } else {
      if (!inAuth) {
        router.replace(hasLanguage ? '/(auth)/login' : '/(auth)/language');
      }
    }
  }, [session, initialized, langChecked, hasLanguage, segments]);

  if (!initialized || !langChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1117' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="person/[id]" />
    </Stack>
  );
}
