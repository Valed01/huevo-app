import { requireNativeModule, type EventSubscription } from 'expo';

type Native = {
  start(uaSuffix: string): void;
  stop(): void;
  takeLaunchPath(): string | null;
  wasPermissionAsked(): boolean;
  setPermissionAsked(): void;
  addListener(event: 'onOpenPath', listener: (e: { path: string }) => void): EventSubscription;
};

const native = requireNativeModule<Native>('HuevoNotify');

/** Background check for new messages and notifications (WorkManager, ~15 min, network only). */
export const startNotifications = (uaSuffix: string) => native.start(uaSuffix);
export const stopNotifications = () => native.stop();

/** Site path of the notification the app was opened from, if any (consumed on read). */
export const takeLaunchPath = () => native.takeLaunchPath();
/** Notification tapped while the app is already running. */
export const addOpenPathListener = (listener: (path: string) => void) =>
  native.addListener('onOpenPath', (e) => listener(e.path));

export const wasPermissionAsked = () => native.wasPermissionAsked();
export const setPermissionAsked = () => native.setPermissionAsked();
