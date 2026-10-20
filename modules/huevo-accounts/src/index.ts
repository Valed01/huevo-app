import { requireNativeModule } from 'expo';

export type Account = {
  id: string;
  name?: string;
  /** Site username (profile path). */
  user?: string;
  avatar?: string;
  loggedIn?: boolean;
};

type Native = {
  isSupported(): boolean;
  list(): string;
  current(): string;
  add(): string;
  setCurrent(id: string): void;
  update(id: string, info: string): void;
  remove(id: string): Promise<void>;
  deletePending(): Promise<void>;
};

const native = requireNativeModule<Native>('HuevoAccounts');

/**
 * Several huEVO accounts, each in its own WebView profile (cookies and storage).
 * The WebView takes the current account's profile when it's created, so after
 * changing the current account the WebView must be recreated.
 */
export const accountsSupported = () => native.isSupported();

export function listAccounts(): Account[] {
  try {
    return JSON.parse(native.list());
  } catch {
    return [];
  }
}

export const currentAccount = () => native.current();
/** Creates an empty account and makes it current. */
export const addAccount = () => native.add();
export const setCurrentAccount = (id: string) => native.setCurrent(id);
export const updateAccount = (id: string, info: Omit<Account, 'id'>) => native.update(id, JSON.stringify(info));
/** Removes a (non-current) account and its data on the device. */
export const removeAccount = (id: string) => native.remove(id);
/** Deletes removed accounts' profiles once their WebView is gone. */
export const deleteRemovedProfiles = () => native.deletePending();
