import { requireNativeModule, type EventSubscription } from 'expo';

export type Release = {
  tag: string;
  version: string;
  /** Release text from GitHub (markdown). */
  notes: string;
  apkUrl: string;
  pageUrl: string;
};

type Native = {
  start(repo: string): void;
  check(force: boolean, ignoreSnooze: boolean): Promise<Release | null>;
  installedVersion(): string | null;
  snooze(): void;
  skip(tag: string): void;
  install(url: string, tag: string): Promise<void>;
  takeLaunchRequest(): boolean;
  addListener(event: 'onShowUpdate', listener: () => void): EventSubscription;
  addListener(event: 'onProgress', listener: (e: { percent: number }) => void): EventSubscription;
};

const native = requireNativeModule<Native>('HuevoUpdate');

/** Daily background check for new GitHub releases of `repo` ("owner/name"). */
export const startUpdateChecks = (repo: string) => native.start(repo);
/** Release worth offering now (newer, not skipped, not snoozed unless ignoreSnooze), or null. */
export const checkForUpdate = (opts: { force?: boolean; ignoreSnooze?: boolean } = {}) =>
  native.check(!!opts.force, !!opts.ignoreSnooze);
export const installedVersion = () => native.installedVersion();
/** "Позже": don't offer again for a day. */
export const snoozeUpdate = () => native.snooze();
/** "Не показывать": stay quiet until a newer release than `tag`. */
export const skipUpdate = (tag: string) => native.skip(tag);
export const installUpdate = (release: Release) => native.install(release.apkUrl, release.tag);
export const takeUpdateLaunchRequest = () => native.takeLaunchRequest();
export const addShowUpdateListener = (listener: () => void) => native.addListener('onShowUpdate', listener);
export const addUpdateProgressListener = (listener: (percent: number) => void) =>
  native.addListener('onProgress', (e) => listener(e.percent));
