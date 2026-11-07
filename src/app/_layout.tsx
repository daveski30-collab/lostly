import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { C, F } from '../components/ui';
import { onNudgeTapped, syncGeofences } from '../lib/platform';
import { getPlaces } from '../lib/store';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });

  useEffect(() => {
    // Keep the phone's watched places in sync each time the app opens.
    getPlaces().then(syncGeofences).catch(() => {});
    return onNudgeTapped((path) => router.push(path as never));
  }, []);

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerTintColor: C.ink,
          headerTitleStyle: { fontFamily: F.bold, fontSize: 18 },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="place/[id]" options={{ title: 'Place' }} />
        <Stack.Screen name="check/[id]" options={{ title: 'Got everything?', presentation: 'modal' }} />
        <Stack.Screen name="test" options={{ title: 'Test lab' }} />
      </Stack>
    </>
  );
}
