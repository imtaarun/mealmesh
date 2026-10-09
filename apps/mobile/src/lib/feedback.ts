import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Haptics for the moments that matter; silently nothing on web or devices without them.
const run = (feel: () => Promise<void>) => {
  if (Platform.OS !== "web") feel().catch(() => {});
};

export const haptic = {
  tap: () => run(() => Haptics.selectionAsync()),
  step: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
