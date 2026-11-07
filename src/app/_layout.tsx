import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { C } from '../components/ui';
import { onNudgeTapped, syncGeofences } from '../lib/platform';
import { getPlaces } from '../lib/store';

export default function RootLayout() {
  useEffect(() => {
    // Keep the phone's watched places in sync each time the app opens.
    getPlaces().then(syncGeofences).catch(() => {});
    return onNudgeTapped((path) => router.push(path as never));
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Lostly' }} />
        <Stack.Screen name="place/[id]" options={{ title: 'Place' }} />
        <Stack.Screen name="check/[id]" options={{ title: 'Got everything?', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
