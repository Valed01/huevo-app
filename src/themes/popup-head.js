/**
 * Runs in the editor's <head>: puts the editor on huEVO's own stylesheets and
 * modes (theme-modern, square corners, dark scheme), taken from the page that
 * opened it, so every control renders exactly like the site's.
 */
(function () {
  var root = document.documentElement;
  root.classList.add('huevo-app');

  var site = null;
  try { if (window.parent !== window) site = window.parent.document; } catch (e) {}
  if (!site) {
    var scheme = new URLSearchParams(location.search).get('scheme');
    root.classList.add('theme-modern');
    if (scheme === 'dark') root.classList.add('hue-dark');
    return;
  }

  site.documentElement.classList.forEach(function (c) {
    if (/^(theme-|hue-sq$|hue-dark$|hue-light$)/.test(c)) root.classList.add(c);
  });
  var scheme = site.documentElement.getAttribute('data-scheme');
  if (scheme) root.setAttribute('data-scheme', scheme);

  // Site CSS goes first so the editor skin (popup.mobile.css) can build on it.
  var before = document.querySelector('link[href="popup.css"]');
  site.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
    if (!l.href || l.href.indexOf('/__huevo_themes__/') >= 0) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = l.href;
    document.head.insertBefore(link, before);
  });
})();
