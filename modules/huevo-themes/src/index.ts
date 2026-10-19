import { requireNativeModule } from 'expo';

type Native = {
  saveToDownloads(name: string, base64: string, mime: string): Promise<string>;
};

const native = requireNativeModule<Native>('HuevoThemes');

/**
 * Loading this module installs the asset server for https://huevo.su/__huevo_themes__/
 * (see AssetServer.kt), so import it before the WebView loads.
 */
export const saveToDownloads = (name: string, base64: string, mime: string) =>
  native.saveToDownloads(name, base64, mime);
