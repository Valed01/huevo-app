/**
 * App integration for huEVO Themes: a "Темы оформления" item in the side menu,
 * the avatar menu and Settings → Оформление (built from the site's own markup
 * so it looks native), and a bottom sheet hosting the editor (popup.html) in a
 * same-origin iframe.
 */
(function () {
  if (window.__huevoThemes) return;

  var BASE = location.origin + '/__huevo_themes__/';
  var OPEN = 'huevo-themes-open';
  var LABEL = 'Темы оформления';
  var sheet = null;

  // Lucide "palette", drawn like the site's other menu icons (24px grid, 2px stroke).
  var ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' " +
    "stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E" +
    "%3Ccircle cx='13.5' cy='6.5' r='1' fill='black'/%3E%3Ccircle cx='17.5' cy='10.5' r='1' fill='black'/%3E" +
    "%3Ccircle cx='8.5' cy='7.5' r='1' fill='black'/%3E%3Ccircle cx='6.5' cy='12.5' r='1' fill='black'/%3E" +
    "%3Cpath d='M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13" +
    "a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z'/%3E%3C/svg%3E\")";

  var CSS = [
    '.hue-ico.huevo-ico-palette{-webkit-mask-image:' + ICON + ';mask-image:' + ICON + '}',
    '#huevo-themes-sheet{position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;justify-content:flex-end}',
    '#huevo-themes-sheet .hts-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;transition:opacity .2s ease}',
    '#huevo-themes-sheet .hts-panel{position:relative;height:90vh;height:90dvh;background:var(--card,#fff);',
    'border-radius:var(--radius,10px) var(--radius,10px) 0 0;display:flex;flex-direction:column;overflow:hidden;',
    'transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.2,1)}',
    '#huevo-themes-sheet.open .hts-backdrop{opacity:1}',
    '#huevo-themes-sheet.open .hts-panel{transform:none}',
    '#huevo-themes-sheet .hts-grab{flex:none;height:18px;display:flex;align-items:center;justify-content:center;touch-action:none}',
    '#huevo-themes-sheet .hts-grab:before{content:"";width:36px;height:4px;border-radius:2px;background:var(--line-strong,#ccc)}',
    '#huevo-themes-sheet iframe{flex:1;width:100%;border:0;background:transparent}',
    'html.huevo-themes-lock,html.huevo-themes-lock body{overflow:hidden!important}'
  ].join('\n');

  function post(msg) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
  }

  function addStyle() {
    if (document.getElementById('huevo-themes-app-css')) return;
    var s = document.createElement('style');
    s.id = 'huevo-themes-app-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

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
    if (ico) ico.className = 'hue-ico huevo-ico-palette';
    var label = a.querySelector('span:not(.hue-ico)');
    if (label) label.textContent = LABEL;
    else a.appendChild(document.createTextNode(LABEL));
    row.insertAdjacentElement('afterend', copy);
  }

  function addButtons() {
    // Side menu (the "Меню" sheet on mobile): right after "Настройки".
    var side = document.querySelector('#sidebar-nav a[href="/settings"]');
    if (side && side.closest('tr') && !document.querySelector('#sidebar-nav .' + OPEN)) sideMenuItem(side);

    // Avatar menu: plain link after "Настройки", like its neighbours.
    var drop = document.querySelector('#mh-user-menu a[href="/settings"]');
    if (drop && !document.querySelector('#mh-user-menu .' + OPEN)) {
      var a = document.createElement('a');
      a.href = '#';
      a.className = OPEN;
      a.textContent = LABEL;
      drop.insertAdjacentElement('afterend', a);
    }

    // Settings → Оформление: a regular settings row.
    var card = document.querySelector('#theme.vk-card');
    if (card && !card.querySelector('.' + OPEN)) {
      var row = document.createElement('div');
      row.className = 'ac-row';
      row.innerHTML = '<div class="ac-label">' + LABEL + '</div>' +
        '<div class="ac-value vk-muted">Готовые темы, обои, цвета и эффекты</div>';
      var open = document.createElement('a');
      open.href = '#';
      open.className = 'ac-act ac-link ' + OPEN;
      open.textContent = 'Открыть';
      row.appendChild(open);
      var title = card.querySelector('.vk-card-title');
      if (title) title.insertAdjacentElement('afterend', row);
      else card.appendChild(row);
    }
  }

  function closeSiteMenus() {
    // The site's own API for the mobile side menu; Escape closes its dropdowns.
    if (typeof window.hueMobileMenu === 'function') {
      var cell = document.getElementById('sidebar-cell');
      if (cell && cell.classList.contains('menu-open')) window.hueMobileMenu(false);
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  function open() {
    if (sheet) return;
    closeSiteMenus();
    var dark = document.documentElement.classList.contains('hue-dark');
    sheet = document.createElement('div');
    sheet.id = 'huevo-themes-sheet';
    sheet.innerHTML = '<div class="hts-backdrop"></div><div class="hts-panel"><div class="hts-grab"></div>' +
      '<iframe title="' + LABEL + '" src="' + BASE + 'popup.html?app=1&scheme=' + (dark ? 'dark' : 'light') + '"></iframe></div>';
    document.body.appendChild(sheet);
    document.documentElement.classList.add('huevo-themes-lock');
    sheet.querySelector('.hts-backdrop').addEventListener('click', close);
    dragToClose(sheet.querySelector('.hts-grab'), sheet.querySelector('.hts-panel'));
    requestAnimationFrame(function () { requestAnimationFrame(function () { sheet && sheet.classList.add('open'); }); });
    post({ type: 'themes-sheet', open: true });
  }

  function close() {
    if (!sheet) return;
    var el = sheet;
    sheet = null;
    el.classList.remove('open');
    document.documentElement.classList.remove('huevo-themes-lock');
    setTimeout(function () { el.remove(); }, 240);
    post({ type: 'themes-sheet', open: false });
  }

  function dragToClose(handle, panel) {
    var startY = null, dy = 0;
    handle.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
      panel.style.transition = 'none';
    }, { passive: true });
    handle.addEventListener('touchmove', function (e) {
      if (startY == null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      panel.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    handle.addEventListener('touchend', function () {
      panel.style.transition = '';
      panel.style.transform = '';
      if (dy > 120) close();
      startY = null;
      dy = 0;
    });
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
    setTimeout(function () { pending = false; addButtons(); }, 60);
  }

  function start() {
    addStyle();
    addButtons();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  window.addEventListener('pagehide', close);

  window.__huevoThemes = { open: open, close: close, isOpen: function () { return !!sheet; } };
})();
