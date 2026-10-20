import { requireNativeModule, type EventSubscription } from 'expo';

type Native = {
  start(uaSuffix: string): void;
  stop(): void;
  takeLaunch(): { path: string; account?: string | null } | null;
  wasPermissionAsked(): boolean;
  setPermissionAsked(): void;
  openSettings(): void;
  addListener(event: 'onOpenPath', listener: (e: OpenPath) => void): EventSubscription;
};

/** A tapped notification: site path and the account it's for (modules/huevo-accounts). */
export type OpenPath = { path: string; account?: string | null };

const native = requireNativeModule<Native>('HuevoNotify');

/** Background check for new messages and notifications (WorkManager, ~15 min, network only). */
export const startNotifications = (uaSuffix: string) => native.start(uaSuffix);
export const stopNotifications = () => native.stop();

/** The notification the app was opened from, if any (consumed on read). */
export const takeLaunch = (): OpenPath | null => native.takeLaunch();
/** Notification tapped while the app is already running. */
export const addOpenPathListener = (listener: (open: OpenPath) => void) =>
  native.addListener('onOpenPath', listener);

/** Opens Android's notification settings for huEVO. */
export const openNotificationSettings = () => native.openSettings();

export const wasPermissionAsked = () => native.wasPermissionAsked();
export const setPermissionAsked = () => native.setPermissionAsked();
