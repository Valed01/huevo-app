/**
 * Minimal chrome.* extension API for running huEVO Themes inside the app's WebView.
 *
 * - chrome.storage.local / sync: IndexedDB on the site's origin, shared by the
 *   content script (page) and the editor (same-origin iframe). Small values are
 *   mirrored to localStorage so the content script gets its settings
 *   synchronously at document start (no flash of the default theme).
 * - chrome.storage.onChanged and chrome.runtime.onMessage / chrome.tabs.sendMessage:
 *   delivered across frames with BroadcastChannel.
 * - chrome.runtime.getURL: files served by the app at /__huevo_themes__/.
 */
(function () {
  if (window.chrome && window.chrome.__huevoShim) return;

  var BASE = location.origin + '/__huevo_themes__/';
  var DB_NAME = 'huevo-themes';
  var STORE = 'kv';
  var MIRROR_KEY = 'huevo_themes_mirror';
  var MIRROR_MAX = 1500000;

  var cache = null;
  var changeListeners = [];
  var messageListeners = [];
  var channel = 'BroadcastChannel' in window ? new BroadcastChannel('huevo-themes') : null;

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  // The page (content script) gets settings adapted to the mobile site; the editor sees them as stored.
  var IS_PAGE = window === window.top;
  var SETTINGS_KEY = 'huevo_theme_settings';

  function adaptSettings(s) {
    if (!IS_PAGE || !s || typeof s !== 'object') return s;
    // "Стандартная" (app preset): the site's own look, no theme at all.
    if (s.activeThemeId === 'standard') s.enabled = false;
    // The sidebar panel is desktop-only: it pins the menu to 185px and breaks the mobile slide-out menu.
    if (s.customTheme) s.customTheme.sidebarCard = false;
    // The clock widget isn't part of the app.
    if (s.clock) s.clock.enabled = false;
    return s;
  }

  function adaptChanges(changes) {
    if (changes[SETTINGS_KEY]) changes[SETTINGS_KEY].newValue = adaptSettings(changes[SETTINGS_KEY].newValue);
    return changes;
  }

  function adaptMessage(msg) {
    if (!IS_PAGE || !msg) return msg;
    if (msg.type === 'HUEVO_LIVE_UPDATE' && (msg.key === 'sidebarCard' || /^clock/i.test(msg.key || ''))) return null;
    if (msg.settings) msg.settings = adaptSettings(msg.settings);
    return msg;
  }

  try {
    var mirror = localStorage.getItem(MIRROR_KEY);
    if (mirror) cache = JSON.parse(mirror);
  } catch (e) {}

  var dbPromise = new Promise(function (resolve) {
    try {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    } catch (e) {
      resolve(null);
    }
  });

  // IndexedDB is the source of truth; the mirror may be missing large values.
  var ready = dbPromise.then(function (db) {
    if (!db) { cache = cache || {}; return; }
    return new Promise(function (resolve) {
      var out = {};
      var cursor = db.transaction(STORE).objectStore(STORE).openCursor();
      cursor.onsuccess = function (e) {
        var c = e.target.result;
        if (c) { out[c.key] = c.value; c.continue(); } else { cache = out; resolve(); }
      };
      cursor.onerror = function () { cache = cache || {}; resolve(); };
    });
  });

  function writeMirror() {
    try {
      var s = JSON.stringify(cache);
      if (s.length <= MIRROR_MAX) localStorage.setItem(MIRROR_KEY, s);
      else localStorage.removeItem(MIRROR_KEY);
    } catch (e) {
      try { localStorage.removeItem(MIRROR_KEY); } catch (e2) {}
    }
  }

  function persist(changes) {
    writeMirror();
    dbPromise.then(function (db) {
      if (!db) return;
      var store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      Object.keys(changes).forEach(function (k) {
        if (changes[k].newValue === undefined) store.delete(k);
        else store.put(changes[k].newValue, k);
      });
    });
  }

  function notify(changes) {
    changeListeners.slice().forEach(function (fn) {
      try { fn(adaptChanges(clone(changes)), 'local'); } catch (e) {}
    });
  }

  function pick(keys) {
    var out = pickRaw(keys);
    if (out && out[SETTINGS_KEY]) out[SETTINGS_KEY] = adaptSettings(out[SETTINGS_KEY]);
    return out;
  }

  function pickRaw(keys) {
    var out = {};
    if (keys == null) return clone(cache);
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) {
      keys.forEach(function (k) { if (k in cache) out[k] = cache[k]; });
    } else {
      Object.keys(keys).forEach(function (k) { out[k] = k in cache ? cache[k] : keys[k]; });
    }
    return clone(out);
  }

  function update(mutator, callback) {
    return ready.then(function () {
      var changes = mutator();
      if (Object.keys(changes).length) {
        persist(changes);
        notify(changes);
        if (channel) channel.postMessage({ t: 'storage', changes: changes });
      }
      if (callback) callback();
    });
  }

  var area = {
    get: function (keys, callback) {
      // Answer synchronously when the localStorage mirror is enough (document start).
      if (cache && callback && keys != null && typeof keys !== 'function') {
        var list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        var mirrored = list.every(function (k) { return k in cache; });
        if (mirrored) { callback(pick(keys)); return Promise.resolve(pick(keys)); }
      }
      if (typeof keys === 'function') { callback = keys; keys = null; }
      return ready.then(function () {
        var result = pick(keys);
        if (callback) callback(result);
        return result;
      });
    },
    set: function (items, callback) {
      return update(function () {
        var changes = {};
        Object.keys(items).forEach(function (k) {
          changes[k] = { oldValue: cache[k], newValue: clone(items[k]) };
          cache[k] = clone(items[k]);
        });
        return changes;
      }, callback);
    },
    remove: function (keys, callback) {
      return update(function () {
        var changes = {};
        (typeof keys === 'string' ? [keys] : keys).forEach(function (k) {
          if (k in cache) { changes[k] = { oldValue: cache[k] }; delete cache[k]; }
        });
        return changes;
      }, callback);
    },
    clear: function (callback) {
      return update(function () {
        var changes = {};
        Object.keys(cache).forEach(function (k) { changes[k] = { oldValue: cache[k] }; });
        cache = {};
        return changes;
      }, callback);
    },
    getBytesInUse: function (keys, callback) {
      if (callback) callback(0);
      return Promise.resolve(0);
    }
  };

  function deliverMessage(msg) {
    msg = adaptMessage(clone(msg));
    if (!msg) return;
    messageListeners.slice().forEach(function (fn) {
      try { fn(clone(msg), { id: 'huevo-themes' }, function () {}); } catch (e) {}
    });
  }

  if (channel) {
    channel.onmessage = function (e) {
      var d = e.data || {};
      if (d.t === 'storage') {
        ready.then(function () {
          Object.keys(d.changes).forEach(function (k) {
            if (d.changes[k].newValue === undefined) delete cache[k];
            else cache[k] = d.changes[k].newValue;
          });
          notify(d.changes);
        });
      } else if (d.t === 'msg') {
        deliverMessage(d.msg);
      }
    };
  }

  function listenerSet(list) {
    return {
      addListener: function (fn) { list.push(fn); },
      removeListener: function (fn) {
        var i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      },
      hasListener: function (fn) { return list.indexOf(fn) >= 0; }
    };
  }

  var chromeApi = window.chrome || {};
  chromeApi.__huevoShim = true;
  chromeApi.storage = { local: area, sync: area, onChanged: listenerSet(changeListeners) };
  chromeApi.runtime = {
    id: 'huevo-themes',
    lastError: undefined,
    getURL: function (path) { return BASE + String(path || '').replace(/^\/+/, ''); },
    onMessage: listenerSet(messageListeners),
    sendMessage: function (msg, callback) {
      if (channel) channel.postMessage({ t: 'msg', msg: msg });
      if (typeof callback === 'function') callback();
    }
  };
  chromeApi.tabs = {
    query: function (q, callback) {
      var tabs = [{ id: 1, url: (window.top || window).location.href, active: true }];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    },
    sendMessage: function (tabId, msg, callback) {
      deliverMessage(msg);
      if (channel) channel.postMessage({ t: 'msg', msg: msg });
      if (typeof callback === 'function') callback({ status: 'ok' });
    },
    create: function () {}
  };
  window.chrome = chromeApi;
})();
