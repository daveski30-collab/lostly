// Phone-only code: background geofencing + notifications.
// The ".native.ts" ending means this file is used on iPhone/Android; platform.ts is used on the web.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { handleEnter, handleExit } from './engine';
import { MIN_RADIUS_METERS } from './rules';
import type { Place } from './types';

export const GEOFENCE_TASK = 'lostly-geofence';
export const supportsBackgroundNudges = true;

// Must be defined at the top level so the phone can wake the app in the background.
TaskManager.defineTask<{ eventType: Location.LocationGeofencingEventType; region: Location.LocationRegion }>(
  GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    const id = data.region.identifier;
    if (data.eventType === Location.LocationGeofencingEventType.Enter) await handleEnter(id);
    if (data.eventType === Location.LocationGeofencingEventType.Exit) await handleExit(id, notify);
  },
);

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function notify(msg: { title: string; body: string; placeId: string }) {
  await Notifications.scheduleNotificationAsync({
    content: { title: msg.title, body: msg.body, data: { placeId: msg.placeId } },
    trigger: null, // right now
  });
}

/** Ask for everything Lostly needs. Returns a friendly problem message, or null if all good. */
export async function enableNudges(): Promise<string | null> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'Lostly needs location access to know when you leave.';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'Pick "Always allow" location in Settings so Lostly works when the app is closed.';
  const n = await Notifications.requestPermissionsAsync();
  if (!n.granted) return 'Turn on notifications so Lostly can nudge you.';
  return null;
}

export async function nudgesEnabled(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

/** Tell the phone which places to watch. Call after any place changes. */
export async function syncGeofences(places: Place[]) {
  if (!(await nudgesEnabled())) return;
  const regions: Location.LocationRegion[] = places
    .filter((p) => p.location && p.rules.enabled)
    .slice(0, 20) // iOS watches at most 20 regions per app
    .map((p) => ({
      identifier: p.id,
      latitude: p.location!.latitude,
      longitude: p.location!.longitude,
      radius: Math.max(p.radiusMeters, MIN_RADIUS_METERS),
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
  const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (regions.length === 0) {
    if (running) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    return;
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}

/** When the user taps a nudge, open that place's checklist. */
export function onNudgeTapped(open: (placeId: string) => void) {
  const last = Notifications.getLastNotificationResponse();
  const lastId = last?.notification.request.content.data?.placeId;
  if (typeof lastId === 'string') open(lastId);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const id = r.notification.request.content.data?.placeId;
    if (typeof id === 'string') open(id);
  });
  return () => sub.remove();
}
