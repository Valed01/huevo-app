export const SITE_HOST = 'huevo.su';
export const SITE_URL = `https://${SITE_HOST}/`;

/** Appended to the WebView user agent so site admins can tell app traffic apart. */
export const APP_UA_SUFFIX = 'huEVOApp/0.1 (Android; +https://github.com/Valed01/huevo-app)';

/** Site's dark theme-color, used until the page reports its own. */
export const FALLBACK_THEME_COLOR = '#1B1C1E';

export function isInAppUrl(url: string): boolean {
  if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === 'https:' || protocol === 'http:') &&
      (hostname === SITE_HOST || hostname.endsWith(`.${SITE_HOST}`));
  } catch {
    return false;
  }
}

/** Is the color dark enough to need light status bar icons? Accepts #rgb, #rrggbb, rgb(...). */
export function isDarkColor(color: string): boolean {
  let r: number, g: number, b: number;
  const rgb = color.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
  if (rgb) {
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else {
    let h = color.trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return true;
    [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

/**
 * Reports the page's <meta name="theme-color"> to the app so the system bars
 * match the site theme. Re-checks on pjax navigations and theme switches.
 */
export const INJECTED_JS = `
(function () {
  var last = '';
  function report() {
    var m = document.querySelector('meta[name="theme-color"]');
    var c = m && m.getAttribute('content');
    if (!c) c = getComputedStyle(document.body || document.documentElement).backgroundColor;
    if (c && c !== last) {
      last = c;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'theme', color: c }));
    }
  }
  report();
  new MutationObserver(report).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['content', 'class', 'data-scheme']
  });
  true;
})();
`;
