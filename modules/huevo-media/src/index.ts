import { requireNativeModule, type EventSubscription } from 'expo';

export type MediaAction = 'play' | 'pause' | 'stop' | 'nexttrack' | 'previoustrack' | 'seekto';

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
  addListener(
    event: 'onCommand',
    listener: (e: { action: MediaAction; seekTime?: number }) => void,
  ): EventSubscription;
};

const native = requireNativeModule<Native>('HuevoMedia');

export const updateMedia = (state: MediaState) => native.update(state);
export const clearMedia = () => native.clear();
export const addMediaCommandListener = (
  listener: (e: { action: MediaAction; seekTime?: number }) => void,
) => native.addListener('onCommand', listener);
