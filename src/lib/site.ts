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

/**
 * Android WebView ignores navigator.mediaSession, so the site's player
 * (huevo-player.js) has nowhere to publish its track. This shim replaces it,
 * forwards metadata/state to the app (native media notification) and lets the
 * app trigger the page's own action handlers via window.__hueMS.fire().
 * Must run before the site's scripts.
 */
export const MEDIA_SESSION_SHIM = `
(function () {
  if (window.__hueMS) return;
  var handlers = {}, meta = null, playback = 'none', pos = null, last = null;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  function art(list) {
    if (!list || !list.length) return null;
    var best = list[list.length - 1];
    try { return new URL(best.src, location.href).href; } catch (e) { return null; }
  }
  function sync(force) {
    if (!meta || playback === 'none') {
      if (last) { last = null; post({ type: 'media', clear: true }); }
      return;
    }
    var playing = playback === 'playing';
    var position = pos && isFinite(pos.position) ? pos.position : -1;
    var rate = (pos && pos.playbackRate) || 1;
    var cur = {
      title: String(meta.title || ''), artist: String(meta.artist || ''), album: String(meta.album || ''),
      artworkUrl: art(meta.artwork), playing: playing, duration: pos && isFinite(pos.duration) ? pos.duration : -1,
      rate: rate, actions: Object.keys(handlers)
    };
    var now = Date.now();
    var changed = force || !last || JSON.stringify(cur) !== last.key;
    if (!changed && position >= 0 && last.position >= 0) {
      var expected = last.position + (last.playing ? (now - last.at) / 1000 * last.rate : 0);
      changed = Math.abs(position - expected) > 1.5;
    }
    if (!changed) return;
    last = { key: JSON.stringify(cur), position: position, playing: playing, rate: rate, at: now };
    cur.type = 'media';
    cur.position = position;
    post(cur);
  }

  function MediaMetadata(init) {
    init = init || {};
    this.title = init.title || '';
    this.artist = init.artist || '';
    this.album = init.album || '';
    this.artwork = init.artwork || [];
  }
  var session = {
    get metadata() { return meta; },
    set metadata(v) { meta = v || null; sync(); },
    get playbackState() { return playback; },
    set playbackState(v) { playback = v || 'none'; sync(); },
    setActionHandler: function (action, fn) {
      if (fn) handlers[action] = fn; else delete handlers[action];
    },
    setPositionState: function (p) { pos = p || null; sync(); },
    setCameraActive: function () {},
    setMicrophoneActive: function () {}
  };
  try {
    window.MediaMetadata = MediaMetadata;
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  } catch (e) {}

  window.__hueMS = {
    fire: function (action, details) {
      var h = handlers[action];
      if (!h && action === 'stop') h = handlers.pause;
      if (h) { try { h(Object.assign({ action: action }, details || {})); } catch (e) {} }
    }
  };
  window.addEventListener('pagehide', function () { post({ type: 'media', clear: true }); });
  true;
})();
`;
