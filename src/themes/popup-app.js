/**
 * Editor (popup.html) running inside the app: site color scheme, header with a
 * close button, file export through the app (the WebView can't download blob:
 * links), and file pickers that don't hide .hvthm files.
 */
(function () {
  var root = document.documentElement;

  function bridge() {
    try { return (window.top && window.top.ReactNativeWebView) || window.ReactNativeWebView; } catch (e) { return null; }
  }

  // Export: popup.js builds a Blob, links it and clicks. Hand the blob to the app instead.
  var blobs = {};
  var createObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    var url = createObjectURL.call(URL, obj);
    if (obj instanceof Blob) blobs[url] = obj;
    return url;
  };

  function save(name, blob) {
    var reader = new FileReader();
    reader.onload = function () {
      var b = bridge();
      if (!b) return;
      // A generic type keeps the .hvthm extension (Android would otherwise append .json).
      var mime = /\.hvthm$/i.test(name) ? 'application/octet-stream' : (blob.type || 'application/octet-stream');
      b.postMessage(JSON.stringify({ type: 'download', name: name, mime: mime, data: String(reader.result).split(',')[1] || '' }));
    };
    reader.readAsDataURL(blob);
  }

  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var blob = this.download && blobs[this.href];
    if (blob) { save(this.download, blob); return; }
    return click.apply(this, arguments);
  };

  function closeSheet() {
    try { window.parent.__huevoThemes.close(); } catch (e) {}
  }

  /**
   * Regroups the extension's flat tab content into huEVO cards: each section
   * heading becomes a .vk-card with a .vk-card-title, followed by the blocks
   * up to the next heading. Runs before popup.js; elements are moved, not
   * recreated, so popup.js still finds them by id.
   */
  function buildCards() {
    document.body.classList.add('theme-modern');
    document.querySelectorAll('.tab-pane').forEach(function (pane) {
      var card = null;
      Array.prototype.slice.call(pane.children).forEach(function (el) {
        var heading = el.classList.contains('section-heading') || el.classList.contains('section-heading-row');
        if (heading || !card) {
          card = document.createElement('div');
          card.className = 'vk-card hue-ed-card';
          pane.insertBefore(card, el);
        }
        if (heading) el.classList.add('vk-card-title');
        card.appendChild(el);
      });
    });
  }
  if (document.body) buildCards();
  else document.addEventListener('DOMContentLoaded', buildCards);

  document.addEventListener('DOMContentLoaded', function () {
    var logo = document.querySelector('.logo-text');
    if (logo) logo.textContent = 'Темы оформления';

    var right = document.querySelector('.header-right');
    if (right) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'huevo-close';
      btn.setAttribute('aria-label', 'Закрыть');
      btn.addEventListener('click', closeSheet);
      right.appendChild(btn);
    }

    // Android's picker filters by MIME type and has none for .hvthm/.ttf/.css: show all files.
    ['file-import-hvthm', 'file-ui-font', 'file-custom-css'].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.removeAttribute('accept');
    });
  });
})();
