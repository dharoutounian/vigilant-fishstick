import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';

/** Light feedback for selections. No-op where haptics aren't available. */
export function tapFeedback() {
  if (Platform.OS === 'ios') Haptics.selectionAsync().catch(() => {});
}

export function successFeedback() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

/** A yes/no question. Uses a native alert on devices and `window.confirm` on the web. */
export function confirm({
  title,
  message,
  confirmText = 'OK',
  destructive = false,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(message ? `${title}\n\n${message}` : title) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
