import { SITE_HOST } from '@/lib/site';

/**
 * Links to huevo.su opened with the app (Settings → Open by default) arrive here.
 * The app has a single screen, so every site link becomes "/?open=<url>" and the
 * WebView opens that page. Must never throw.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    if (url.hostname === SITE_HOST || url.hostname.endsWith(`.${SITE_HOST}`)) {
      return `/?open=${encodeURIComponent(url.href)}`;
    }
  } catch {
    // not a full URL (e.g. the app's own scheme): fall through
  }
  return '/';
}
