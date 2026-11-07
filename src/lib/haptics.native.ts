// Little taps you feel on the phone. Never throws.
import * as Haptics from 'expo-haptics';

export const tick = () => Haptics.selectionAsync().catch(() => {});
export const thump = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const warn = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
