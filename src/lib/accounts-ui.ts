/**
 * Several accounts, like in Telegram (the app keeps each in its own WebView profile,
 * see modules/huevo-accounts). Runs after load, in every account's page:
 * - reports who is signed in here (username, name, avatar from the site's header);
 * - "Аккаунты" in the avatar menu and the side menu, and on the sign-in page when
 *   other accounts exist: a bottom sheet with the accounts (tap to switch), remove
 *   buttons and "Добавить аккаунт", built from the site's colors so it fits both themes.
 * The app sends the list with window.__huevoAccounts.set() (asked for with accounts-get).
 */
export const ACCOUNTS_JS = `
(function () {
  if (window.__huevoAccounts) return;
  var OPEN = 'huevo-accounts-open';
  var LABEL = 'Аккаунты';
  var state = { accounts: [], current: null, supported: true };
  var sheet = null;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---- Who is signed in here ----
  // Site sections that look like /<name> but aren't profiles.
  var NOT_PROFILE = /^[/](settings|logout|login|signin|register|signup|auth|messages|im|chats?|notifications|friends|feed|news|search|music|audio|video|photos?|groups?|communities|apps|games|market|help|about|rules|privacy|terms|admin|bookmarks|fave|docs|edit|api|static|uploads?)([/]|$)/i;
  var GENERIC_NAME = /^(моя страница|мой профиль|профиль|страница|my page|profile)$/i;

  function profileOf(a) {
    try {
      var u = new URL(a.getAttribute('href'), location.href);
      if (u.host !== location.host) return null;
      var p = u.pathname.replace(/[/]+$/, '');
      if (!/^[/][^/]+$/.test(p) || NOT_PROFILE.test(p)) return null;
      return decodeURIComponent(p.slice(1));
    } catch (e) {
      return null;
    }
  }

  function who() {
    var btn = document.querySelector('.mh-user-btn');
    var menu = document.getElementById('mh-user-menu');
    if (!btn && !menu) return { loggedIn: false };
    var info = { loggedIn: true };
    var links = document.querySelectorAll('a.mh-user-btn[href], .mh-user-btn a[href], #mh-user-menu a[href]');
    for (var i = 0; i < links.length; i++) {
      var user = profileOf(links[i]);
      if (!user) continue;
      info.user = user;
      var text = (links[i].textContent || '').replace(/[\\s]+/g, ' ').trim();
      if (text && text.length <= 60 && !GENERIC_NAME.test(text)) info.name = text;
      break;
    }
    var img = (btn && btn.querySelector('img')) || (menu && menu.querySelector('img'));
    if (img && (img.currentSrc || img.src)) {
      info.avatar = img.currentSrc || img.src;
      var alt = (img.getAttribute('alt') || '').trim();
      if (!info.name && alt && alt.length <= 60 && !/^(avatar|аватар|фото|photo)$/i.test(alt)) info.name = alt;
    }
    return info;
  }

  var lastInfo = '';
  function report() {
    var info = who();
    // Signed out: say so only on the sign-in form, so a page without the header isn't taken for it.
    if (!info.loggedIn && !isSignIn()) return;
    var key = JSON.stringify(info);
    if (key === lastInfo) return;
    lastInfo = key;
    post({ type: 'account-info', info: info });
  }

  function isSignIn() {
    return !document.querySelector('.mh-user-btn, #mh-user-menu') && !!document.querySelector('input[type="password"]');
  }

  // ---- Styles ----
  // Lucide "users", drawn like the site's other menu icons.
  var ICON = "url(\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' " +
    "stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E" +
    "%3Cpath d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='9' cy='7' r='4'/%3E" +
    "%3Cpath d='M22 21v-2a4 4 0 0 0-3-3.87'/%3E%3Cpath d='M16 3.13a4 4 0 0 1 0 7.75'/%3E%3C/svg%3E\\")";

  var CSS = [
    '.hue-ico.huevo-ico-users{-webkit-mask-image:' + ICON + ';mask-image:' + ICON + '}',
    '#huevo-acc{position:fixed;inset:0;z-index:2147483550;display:flex;flex-direction:column;justify-content:flex-end}',
    '#huevo-acc .ha-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;transition:opacity .2s ease}',
    '#huevo-acc .ha-panel{position:relative;max-height:85vh;max-height:85dvh;overflow:auto;background:var(--card,#fff);color:var(--text,#000);',
    'border-radius:var(--radius,10px) var(--radius,10px) 0 0;padding:0 0 10px;transform:translateY(100%);',
    'transition:transform .24s cubic-bezier(.2,.8,.2,1)}',
    '#huevo-acc.open .ha-backdrop{opacity:1}',
    '#huevo-acc.open .ha-panel{transform:none}',
    '#huevo-acc .ha-grab{height:18px;display:flex;align-items:center;justify-content:center}',
    '#huevo-acc .ha-grab:before{content:"";width:36px;height:4px;border-radius:2px;background:var(--line-strong,#ccc)}',
    '#huevo-acc .ha-title{padding:2px 16px 8px;font-weight:600;font-size:15px}',
    '#huevo-acc .ha-row{display:flex;align-items:center;gap:12px;padding:9px 16px;min-height:44px;cursor:pointer;',
    'color:inherit!important;text-decoration:none!important;-webkit-tap-highlight-color:transparent}',
    '#huevo-acc .ha-row:active{background:var(--hover,rgba(127,127,127,.12))}',
    '#huevo-acc .ha-ava{flex:none;width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--line,#ddd);',
    'display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px;color:var(--muted,#888);overflow:hidden}',
    '#huevo-acc .ha-text{flex:1;min-width:0}',
    '#huevo-acc .ha-name{font-size:14.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#huevo-acc .ha-sub{font-size:12.5px;color:var(--muted,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#huevo-acc .ha-check{flex:none;width:22px;height:22px;border-radius:50%;background:#B01E1E;color:#fff;',
    'display:flex;align-items:center;justify-content:center;font-size:13px}',
    '#huevo-acc .ha-del{flex:none;width:32px;height:32px;border:0;border-radius:50%;background:transparent;',
    'color:var(--muted,#888);font-size:20px;line-height:32px;padding:0;cursor:pointer}',
    '#huevo-acc .ha-add .ha-ava{background:transparent;border:1.5px dashed var(--line-strong,#bbb);font-size:22px;font-weight:400}',
    '#huevo-acc .ha-note{padding:6px 16px 4px;font-size:12.5px;color:var(--muted,#888);line-height:1.4}',
    '#huevo-acc-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483400;display:flex;align-items:center;gap:10px;',
    'padding:10px 12px 10px 14px;border-radius:var(--radius,10px);background:var(--card,#fff);color:var(--text,#000);',
    'box-shadow:0 4px 18px rgba(0,0,0,.25);font-size:13.5px}',
    '#huevo-acc-bar span{flex:1}',
    'html.huevo-acc-lock,html.huevo-acc-lock body{overflow:hidden!important}'
  ].join('\\n');

  function addStyle() {
    if (document.getElementById('huevo-acc-css')) return;
    var s = document.createElement('style');
    s.id = 'huevo-acc-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- Entry points ----
  function sideMenuItem(settingsLink) {
    // Copy the "Настройки" row so the item gets the site's exact structure and styles.
    var row = settingsLink.closest('tr');
    var copy = row.cloneNode(true);
    var a = copy.querySelector('a');
    a.setAttribute('href', '#');
    a.removeAttribute('data-nav');
    a.classList.remove('active', 'on', 'sel');
    a.classList.add(OPEN);
    var ico = a.querySelector('.hue-ico');
    if (ico) ico.className = 'hue-ico huevo-ico-users';
    var label = a.querySelector('span:not(.hue-ico)');
    if (label) label.textContent = LABEL;
    else a.appendChild(document.createTextNode(LABEL));
    row.insertAdjacentElement('beforebegin', copy);
  }

  function addButtons() {
    var side = document.querySelector('#sidebar-nav a[href="/settings"]');
    if (side && side.closest('tr') && !document.querySelector('#sidebar-nav .' + OPEN)) sideMenuItem(side);

    var drop = document.querySelector('#mh-user-menu a[href="/settings"]');
    if (drop && !document.querySelector('#mh-user-menu .' + OPEN)) {
      var a = document.createElement('a');
      a.href = '#';
      a.className = OPEN;
      a.textContent = LABEL;
      drop.insertAdjacentElement('beforebegin', a);
    }

    // Sign-in page while other accounts exist: a way back to them.
    var bar = document.getElementById('huevo-acc-bar');
    var want = state.accounts.length > 1 && isSignIn();
    if (want && !bar) {
      bar = document.createElement('div');
      bar.id = 'huevo-acc-bar';
      bar.innerHTML = '<span>Вход в ещё один аккаунт</span><a href="#" class="vk-btn ' + OPEN + '">' + LABEL + '</a>';
      document.body.appendChild(bar);
    } else if (!want && bar) {
      bar.remove();
    }
  }

  // ---- Sheet ----
  function avatar(acc) {
    if (acc.avatar) return '<img class="ha-ava" alt="" src="' + esc(acc.avatar) + '">';
    var letter = (acc.name || acc.user || '?').replace(/^@/, '').charAt(0).toUpperCase();
    return '<div class="ha-ava">' + esc(letter) + '</div>';
  }

  function rows() {
    var many = state.accounts.length > 1;
    return state.accounts.map(function (acc, i) {
      var cur = acc.id === state.current;
      var name = acc.name || (acc.user ? '@' + acc.user : 'Аккаунт ' + (i + 1));
      var sub = acc.loggedIn === false || (!acc.user && !acc.name) ? 'Не выполнен вход' : (acc.user ? '@' + acc.user : '');
      return '<div class="ha-row" data-acc="switch" data-id="' + esc(acc.id) + '">' + avatar(acc) +
        '<div class="ha-text"><div class="ha-name">' + esc(name) + '</div>' +
        (sub ? '<div class="ha-sub">' + esc(sub) + '</div>' : '') + '</div>' +
        (cur ? '<div class="ha-check" aria-label="Текущий">✓</div>' : '') +
        (many ? '<button type="button" class="ha-del" data-acc="remove" data-id="' + esc(acc.id) +
          '" aria-label="Убрать аккаунт">×</button>' : '') +
        '</div>';
    }).join('');
  }

  function render() {
    if (!sheet) return;
    var add = state.supported
      ? '<a href="#" class="ha-row ha-add" data-acc="add"><div class="ha-ava">+</div>' +
        '<div class="ha-text"><div class="ha-name">Добавить аккаунт</div></div></a>'
      : '<div class="ha-note">Чтобы добавить ещё аккаунт, обновите «Android System WebView» в Google Play.</div>';
    sheet.querySelector('.ha-body').innerHTML = rows() + add;
  }

  function closeSiteMenus() {
    if (typeof window.hueMobileMenu === 'function') {
      var cell = document.getElementById('sidebar-cell');
      if (cell && cell.classList.contains('menu-open')) window.hueMobileMenu(false);
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  function open() {
    if (sheet) return;
    closeSiteMenus();
    addStyle();
    sheet = document.createElement('div');
    sheet.id = 'huevo-acc';
    sheet.innerHTML = '<div class="ha-backdrop"></div><div class="ha-panel" role="dialog" aria-modal="true">' +
      '<div class="ha-grab"></div><div class="ha-title">' + LABEL + '</div><div class="ha-body"></div></div>';
    document.body.appendChild(sheet);
    render();
    document.documentElement.classList.add('huevo-acc-lock');
    sheet.querySelector('.ha-backdrop').addEventListener('click', close);
    sheet.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-acc]') : null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      var act = el.getAttribute('data-acc');
      var id = el.getAttribute('data-id');
      if (act === 'switch' && id === state.current) { close(); return; }
      if (act === 'switch') post({ type: 'account-switch', id: id });
      if (act === 'add') post({ type: 'account-add' });
      if (act === 'remove') { post({ type: 'account-remove', id: id }); return; }
      close();
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { sheet && sheet.classList.add('open'); }); });
    post({ type: 'accounts-sheet', open: true });
  }

  function close() {
    if (!sheet) return;
    var el = sheet;
    sheet = null;
    el.classList.remove('open');
    document.documentElement.classList.remove('huevo-acc-lock');
    setTimeout(function () { el.remove(); }, 240);
    post({ type: 'accounts-sheet', open: false });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.' + OPEN) : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }, true);

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; addButtons(); report(); }, 80);
  }

  window.__huevoAccounts = {
    set: function (s) {
      state = s;
      render();
      schedule();
    },
    open: open,
    close: close,
    isOpen: function () { return !!sheet; }
  };

  addStyle();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
  post({ type: 'accounts-get' });
  true;
})();
`;
