import { requireNativeModule } from 'expo';

export type MediaState = {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string | null;
  playing: boolean;
  /** Seconds, -1 if unknown. */
  position: number;
  duration: number;
  rate: number;
  /** Actions the page registered handlers for. */
  actions: string[];
};

type Native = {
  update(state: MediaState): void;
  clear(): void;
};

const native = requireNativeModule<Native>('HuevoMedia');

/**
 * Starts mirroring the page's player into the media notification. After this
 * the native side drives itself (it talks to the WebView directly), so later
 * calls only speed up updates while the app is in foreground.
 */
export const updateMedia = (state: MediaState) => native.update(state);
export const clearMedia = () => native.clear();
