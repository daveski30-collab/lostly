// Web version. Browsers cannot watch your location in the background,
// so on the web Lostly is a preview: set up places and use "Try leaving" to test the rules.

import type { NotifyMsg } from './engine';
import type { Place } from './types';

export const supportsBackgroundNudges = false;

export async function notify(_msg: NotifyMsg) {
  // On the web the app shows the checklist directly instead of a notification.
}

export async function enableNudges(): Promise<string | null> {
  return 'Background nudges need the phone app. On the web, use "Try leaving" to test.';
}

export async function nudgesEnabled() {
  return false;
}

export async function syncGeofences(_places: Place[]) {}

export function onNudgeTapped(_open: (path: string) => void) {
  return () => {};
}
