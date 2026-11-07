// Phone-only code: background geofencing + notifications.
// The ".native.ts" ending means this file is used on iPhone/Android; platform.ts is used on the web.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { handleEnter, handleExit, type NotifyMsg } from './engine';
import { addCheck, markHandled } from './store';
import { MIN_RADIUS_METERS } from './rules';
import type { Place } from './types';

export const GEOFENCE_TASK = 'lostly-geofence';
const NOTIFICATION_TASK = 'lostly-notification-action';
const CATEGORY = 'lostly-leave';
const ALL_GOOD = 'all_good';
export const supportsBackgroundNudges = true;

// Must be defined at the top level so the phone can wake the app in the background.
TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
  GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    const id = data.region.identifier;
    if (data.eventType === Location.GeofencingEventType.Enter) await handleEnter(id, notify);
    if (data.eventType === Location.GeofencingEventType.Exit) await handleExit(id, notify);
  },
);

// Buttons right on the notification: confirm without even opening the app.
Notifications.setNotificationCategoryAsync(CATEGORY, [
  { identifier: ALL_GOOD, buttonTitle: '✅ Got everything', options: { opensAppToForeground: false } },
  { identifier: 'open', buttonTitle: 'Show my list', options: { opensAppToForeground: true } },
]).catch(() => {});

/** Handle a tap on a nudge. Returns the screen to open, or null if it was handled silently. */
async function handleResponse(r: Notifications.NotificationResponse): Promise<string | null> {
  const { placeId, kind } = (r.notification.request.content.data ?? {}) as { placeId?: unknown; kind?: unknown };
  if (typeof placeId !== 'string') return null;
  // Each nudge is handled once (the app may see the same tap again when it relaunches).
  if (!(await markHandled(`${r.notification.request.identifier}:${r.actionIdentifier}`))) return null;
  if (r.actionIdentifier === ALL_GOOD) {
    await addCheck({ placeId, at: Date.now(), missing: [] });
    return null;
  }
  return kind === 'found' ? '/' : `/check/${placeId}`;
}

// Android runs this when "Got everything" is tapped while the app is closed.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
  if (data && 'actionIdentifier' in data) await handleResponse(data as unknown as Notifications.NotificationResponse);
});
Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function notify(msg: NotifyMsg) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      body: msg.body,
      data: { placeId: msg.placeId, kind: msg.kind },
      // Only "leaving" nudges get the quick-answer buttons.
      ...(msg.kind === 'leave' ? { categoryIdentifier: CATEGORY } : {}),
    },
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

/** When the user taps a nudge, open that place's checklist (or record "Got everything" silently). */
export function onNudgeTapped(open: (path: string) => void) {
  const last = Notifications.getLastNotificationResponse();
  if (last) handleResponse(last).then((id) => id && open(id));
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    handleResponse(r).then((id) => id && open(id));
  });
  return () => sub.remove();
}
