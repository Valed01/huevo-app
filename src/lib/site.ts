export const SITE_HOST = 'huevo.su';
export const SITE_URL = `https://${SITE_HOST}/`;

/** GitHub repo whose releases the app updates from. */
export const GITHUB_REPO = 'Valed01/huevo-app';

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
 * Reports the colors of the site's own bars so the app can continue them under
 * Android's status bar (top: the header) and gesture bar (bottom: the tab bar).
 * Semi-transparent bars are blended over the page background, as they look on
 * screen. Also squares the header's top and the tab bar's bottom corners (themes
 * round them), so the color runs to the screen edge without notches.
 */
export const INJECTED_JS = `
(function () {
  var last = '';
  var style = document.createElement('style');
  style.textContent = '#ap-header-wrap,#mh-bar{border-top-left-radius:0!important;border-top-right-radius:0!important}' +
    '#hue-tabbar{border-bottom-left-radius:0!important;border-bottom-right-radius:0!important}';
  (document.head || document.documentElement).appendChild(style);

  function rgba(c) {
    var m = /rgba?\\(([^)]+)\\)/.exec(c || '');
    if (!m) return null;
    var p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function hex(c) {
    return '#' + [c.r, c.g, c.b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }
  function pageBg() {
    var c = rgba(getComputedStyle(document.documentElement).backgroundColor);
    if (c && c.a > 0) return c;
    c = rgba(getComputedStyle(document.body || document.documentElement).backgroundColor);
    if (c && c.a > 0) return c;
    var m = document.querySelector('meta[name="theme-color"]');
    var h = /#([0-9a-f]{6})/i.exec((m && m.getAttribute('content')) || '#1B1C1E');
    var n = parseInt(h ? h[1] : '1B1C1E', 16);
    return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, a: 1 };
  }
  // The visible color of an element's background, blended over the page.
  function solid(sel) {
    var base = pageBg();
    var el = document.querySelector(sel);
    var c = el && rgba(getComputedStyle(el).backgroundColor);
    if (!c || c.a === 0) return hex(base);
    return hex({ r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) });
  }
  function report() {
    var top = solid('#mh-bar') , bottom = document.getElementById('hue-tabbar') ? solid('#hue-tabbar') : hex(pageBg());
    var key = top + bottom;
    if (key === last) return;
    last = key;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'theme', color: top, bottom: bottom }));
  }
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; report(); }, 150);
  }
  report();
  // Themes and the light/dark switch change the colors.
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['content', 'class', 'data-scheme', 'style']
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
  function state() {
    var audio = document.getElementById('ap-audio');
    var position = audio && isFinite(audio.currentTime) ? audio.currentTime
      : (pos && isFinite(pos.position) ? pos.position : -1);
    var duration = pos && isFinite(pos.duration) ? pos.duration
      : (audio && isFinite(audio.duration) ? audio.duration : -1);
    return {
      title: String(meta.title || ''), artist: String(meta.artist || ''), album: String(meta.album || ''),
      artworkUrl: art(meta.artwork), playing: playback === 'playing', position: position,
      duration: duration, rate: (pos && pos.playbackRate) || 1, actions: Object.keys(handlers)
    };
  }
  function sync(force) {
    if (!meta || playback === 'none') {
      if (last) { last = null; post({ type: 'media', clear: true }); }
      return;
    }
    var cur = state();
    var playing = cur.playing, position = cur.position, rate = cur.rate;
    delete cur.position;
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
    },
    /** Polled by the native module, which can't rely on postMessage while the app is in background. */
    snapshot: function () {
      if (!meta || playback === 'none') return JSON.stringify({ clear: true });
      return JSON.stringify(state());
    }
  };
  window.addEventListener('pagehide', function () { post({ type: 'media', clear: true }); });
  true;
})();
`;

/**
 * Loads the bundled huEVO Themes extension (served by the app at
 * /__huevo_themes__/, see modules/huevo-themes) at document start, like the
 * extension's content scripts. Synchronous so the theme applies before the page paints.
 */
export const THEMES_LOADER = `
(function () {
  if (window.__huevoThemesLoaded || !/(^|\\.)huevo\\.su$/.test(location.hostname)) return;
  window.__huevoThemesLoaded = true;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', location.origin + '/__huevo_themes__/content-bundle.js', false);
    xhr.send();
    if (xhr.status === 200) (0, eval)(xhr.responseText + '\\n//# sourceURL=huevo-themes-bundle.js');
  } catch (e) {}
  true;
})();
`;

/**
 * Small app-only additions to the site's UI. Runs after load and re-applies
 * after the site's pjax navigation.
 * - "Настройки" in the bell dropdown and on /notifications: opens Android's
 *   notification settings for the app.
 * - touches report whether native pull-to-refresh may start from them.
 * - window.__huevoUpdate: the "new version" dialog, built from the site's own
 *   components (.vk-card, .vk-btn) so it looks native in light and dark.
 */
export const APP_UI_JS = `
(function () {
  if (window.__huevoAppUi) return;
  window.__huevoAppUi = true;
  var CLS = 'huevo-notif-settings';

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function link(extra) {
    var a = document.createElement('a');
    a.href = '#';
    a.className = CLS + (extra ? ' ' + extra : '');
    a.textContent = 'Настройки';
    return a;
  }

  function apply() {
    var head = document.querySelector('#mh-notif .mh-notif-head');
    if (head && !head.querySelector('.' + CLS)) {
      head.style.gap = '14px';
      var title = head.querySelector('b');
      if (title) title.style.marginRight = 'auto';
      var all = head.querySelector('a');
      head.insertBefore(link(), all);
    }
    if (location.pathname === '/notifications') {
      var cardTitle = document.querySelector('#main-content .vk-card-title');
      if (cardTitle && !cardTitle.querySelector('.' + CLS)) cardTitle.appendChild(link('vk-title-btn vk-btn'));
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.' + CLS) : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    post({ type: 'open-notification-settings' });
  }, true);

  // ---- Update dialog ----
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // GitHub release text (markdown) -> short HTML: headings, list items, bold, code; links become plain text.
  function notesHtml(md) {
    var out = [], list = false;
    String(md || '').replace(/\\r/g, '').split('\\n').forEach(function (line) {
      line = line.trim();
      if (!line || /^\\*\\*Full Changelog\\*\\*/i.test(line) || /^<!--/.test(line)) return;
      var inline = function (t) {
        return esc(t
          .replace(/\\s+by @[\\w-]+ in https?:\\/\\/\\S+$/i, '')
          .replace(/\\s+in https?:\\/\\/github\\.com\\/\\S+\\/pull\\/\\d+$/i, '')
          .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1'))
          .replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>')
          .replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>');
      };
      var item = line.match(/^[-*+]\\s+(.*)$/);
      if (item) {
        if (!list) { out.push('<ul class="huevo-upd-list">'); list = true; }
        out.push('<li>' + inline(item[1]) + '</li>');
        return;
      }
      if (list) { out.push('</ul>'); list = false; }
      var head = line.match(/^#{1,6}\\s+(.*)$/);
      if (head) {
        if (/^what'?s changed$/i.test(head[1].trim())) return;
        out.push('<div class="huevo-upd-sub">' + inline(head[1]) + '</div>');
      } else {
        out.push('<p>' + inline(line) + '</p>');
      }
    });
    if (list) out.push('</ul>');
    return out.join('') || '<p class="vk-muted">Список изменений не указан.</p>';
  }

  var UPD_CSS = '#huevo-upd{position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;' +
    'padding:16px;background:rgba(0,0,0,.5)}' +
    '#huevo-upd .huevo-upd-card{width:100%;max-width:420px;max-height:80vh;max-height:80dvh;display:flex;flex-direction:column;margin:0}' +
    '#huevo-upd .vk-card-title{flex:none;margin:0}' +
    '#huevo-upd .huevo-upd-body{overflow:auto;padding:12px 14px;font-size:13.5px;line-height:1.45;color:var(--text)}' +
    '#huevo-upd .huevo-upd-body p{margin:0 0 8px}' +
    '#huevo-upd .huevo-upd-sub{margin:10px 0 6px;font-weight:600}' +
    '#huevo-upd .huevo-upd-list{margin:0 0 8px;padding-left:18px}' +
    '#huevo-upd .huevo-upd-list li{margin:0 0 4px}' +
    '#huevo-upd .huevo-upd-foot{flex:none;padding:12px 14px 14px;border-top:1px solid var(--line)}' +
    '#huevo-upd .vk-btn-row{margin:0}' +
    '#huevo-upd .vk-btn-row .vk-btn{flex:1 1 0}' +
    '#huevo-upd .huevo-upd-skip{display:block;margin-top:10px;text-align:center;font-size:12.5px;color:var(--muted)!important}' +
    '#huevo-upd .huevo-upd-status{margin-top:8px;text-align:center;font-size:12.5px;color:var(--muted)}' +
    '#huevo-upd .huevo-upd-status:empty{display:none}';

  var upd = null;
  window.__huevoUpdate = {
    show: function (info) {
      if (upd) upd.remove();
      if (!document.getElementById('huevo-upd-css')) {
        var st = document.createElement('style');
        st.id = 'huevo-upd-css';
        st.textContent = UPD_CSS;
        document.head.appendChild(st);
      }
      upd = document.createElement('div');
      upd.id = 'huevo-upd';
      upd.innerHTML = '<div class="vk-card huevo-upd-card" role="dialog" aria-modal="true">' +
        '<div class="vk-card-title">Обновление huEVO ' + esc(info.version) + '</div>' +
        '<div class="huevo-upd-body">' + notesHtml(info.notes) + '</div>' +
        '<div class="huevo-upd-foot"><div class="vk-btn-row">' +
        '<button type="button" class="vk-btn vk-btn-primary" data-upd="install">Установить</button>' +
        '<button type="button" class="vk-btn" data-upd="later">Позже</button></div>' +
        '<div class="huevo-upd-status" aria-live="polite"></div>' +
        '<a href="#" class="huevo-upd-skip" data-upd="skip">Не показывать для этой версии</a></div></div>';
      upd.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-upd]') : null;
        if (!b) return;
        e.preventDefault();
        var act = b.getAttribute('data-upd');
        if (act === 'install') {
          b.disabled = true;
          upd.querySelector('.huevo-upd-status').textContent = 'Загрузка…';
        }
        post({ type: 'update-' + act, tag: info.tag });
        if (act !== 'install') window.__huevoUpdate.close();
      });
      document.body.appendChild(upd);
    },
    progress: function (pct) {
      var s = upd && upd.querySelector('.huevo-upd-status');
      if (s) s.textContent = pct >= 0 ? 'Загрузка… ' + pct + '%' : 'Загрузка…';
      if (s && pct >= 100) s.textContent = 'Открываю установщик…';
    },
    error: function (text) {
      if (!upd) return;
      upd.querySelector('.huevo-upd-status').textContent = text;
      var b = upd.querySelector('[data-upd="install"]');
      if (b) b.disabled = false;
    },
    close: function () {
      if (upd) { upd.remove(); upd = null; }
    },
    isOpen: function () { return !!upd; }
  };

  // ---- Pull to refresh (native, in the app): may this touch start it? ----
  // Not when the page is scrolled, when the finger is on a scrolled block (chat history,
  // lists) or on an overlay (menus, sheets, players), so the gesture stays theirs.
  function canPullFrom(el) {
    if ((document.scrollingElement || document.documentElement).scrollTop > 0) return false;
    for (var n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
      if (n.id === 'ap-header-wrap' || n.id === 'hue-tabbar') return true;
      var cs = getComputedStyle(n);
      if (cs.position === 'fixed') return false;
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return false;
    }
    return true;
  }
  var lastPull = null;
  var pullOk = true;
  document.addEventListener('touchstart', function (e) {
    // A second finger (pinch zoom) never pulls.
    pullOk = e.touches.length === 1 && canPullFrom(e.target);
    if (pullOk !== lastPull) { lastPull = pullOk; post({ type: 'pull-refresh', ok: pullOk }); }
  }, { capture: true, passive: true });
  // The app's spinner is enabled from the message above, which arrives after the native
  // gesture has already started (often it's still the previous touch's answer). So before
  // reloading, the app asks here whether the gesture that just ended could pull.
  window.__huevoPull = function () {
    var top = (document.scrollingElement || document.documentElement).scrollTop <= 0;
    post({ type: 'pull-confirm', ok: pullOk && top });
  };

  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; apply(); }, 80);
  }).observe(document.body, { childList: true, subtree: true });
  apply();
  true;
})();
`;
