/**
 * Color picker for the theme editor in the app. Replaces Android's small system
 * dialog for every <input type="color">: a bottom sheet with a saturation/brightness
 * field, a hue strip, a hex field, a palette and recent colors, built from huEVO's
 * own color picker classes (.hue-cp-*). The chosen color is written back to the
 * input with input/change events, exactly like the native picker, so popup.js
 * handles it as before.
 */
(function () {
  var RECENT_KEY = 'huevo_cp_recent';
  var PALETTE = [
    '#FFFFFF', '#EDEEF0', '#DCE1E6', '#818C99', '#3A3A3A', '#000000',
    '#B01E1E', '#E64646', '#FF7A45', '#F5A623', '#FFD43B', '#A3C93A',
    '#4BB34B', '#1E8E5A', '#00A3A3', '#5AC8FA', '#4A90E2', '#45668E',
    '#2B587A', '#5C6BC0', '#7E57C2', '#AB47BC', '#E91E63', '#F48FB1'
  ];

  // ---- color math ----
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function normHex(v) {
    var s = String(v || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, function (c) { return c + c; });
    return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toUpperCase() : null;
  }
  function hexToHsv(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }
  function hsvToHex(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    var to = function (u) { return ('0' + Math.round((u + m) * 255).toString(16)).slice(-2); };
    return ('#' + to(r) + to(g) + to(b)).toUpperCase();
  }

  function recent() {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY)) || []).filter(normHex).slice(0, 12); } catch (e) { return []; }
  }
  function remember(hex) {
    var list = recent().filter(function (c) { return c !== hex; });
    list.unshift(hex);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12))); } catch (e) {}
  }

  function labelFor(input) {
    var row = input.closest('.color-item-row, .form-row, .toggle-card, .slider-field, .hue-ed-card');
    var el = row && row.querySelector('.color-item-label, .field-label, .toggle-title, .vk-card-title');
    return (el && el.textContent.trim().replace(/:$/, '')) || 'Цвет';
  }

  // ---- sheet ----
  var sheet = null;

  function open(input) {
    close();
    var start = normHex(input.value) || '#000000';
    var hsv = hexToHsv(start);
    var current = start;

    sheet = document.createElement('div');
    sheet.className = 'hue-cps';
    sheet.innerHTML =
      '<div class="hue-cps-backdrop"></div>' +
      '<div class="hue-cps-panel vk-card" role="dialog" aria-modal="true">' +
        '<div class="vk-card-title"></div>' +
        '<div class="hue-cps-body">' +
          '<div class="hue-cps-sv"><div class="hue-cps-sv-thumb"></div></div>' +
          '<div class="hue-cps-hue"><div class="hue-cps-hue-thumb"></div></div>' +
          '<div class="hue-cps-row">' +
            '<span class="hue-cps-compare"><i class="hue-cps-old" title="Было"></i><i class="hue-cps-new" title="Стало"></i></span>' +
            '<input type="text" class="hue-cp-text hue-cps-hex" maxlength="7" spellcheck="false" autocomplete="off" inputmode="text" aria-label="HEX">' +
          '</div>' +
          '<div class="hue-cp-label">Палитра</div><div class="hue-cp-grid hue-cps-palette"></div>' +
          '<div class="hue-cps-recent-wrap"><div class="hue-cp-label">Недавние</div><div class="hue-cp-grid hue-cps-recent"></div></div>' +
        '</div>' +
        '<div class="hue-cps-foot vk-btn-row">' +
          '<button type="button" class="vk-btn" data-cps="cancel">Отмена</button>' +
          '<button type="button" class="vk-btn vk-btn-primary" data-cps="done">Готово</button>' +
        '</div>' +
      '</div>';
    sheet.querySelector('.vk-card-title').textContent = labelFor(input);
    sheet.querySelector('.hue-cps-old').style.background = start;

    var sv = sheet.querySelector('.hue-cps-sv');
    var svThumb = sheet.querySelector('.hue-cps-sv-thumb');
    var hue = sheet.querySelector('.hue-cps-hue');
    var hueThumb = sheet.querySelector('.hue-cps-hue-thumb');
    var hex = sheet.querySelector('.hue-cps-hex');
    var fresh = sheet.querySelector('.hue-cps-new');

    function render(fromHexField) {
      current = hsvToHex(hsv.h, hsv.s, hsv.v);
      sv.style.backgroundColor = 'hsl(' + hsv.h + ', 100%, 50%)';
      svThumb.style.left = (hsv.s * 100) + '%';
      svThumb.style.top = ((1 - hsv.v) * 100) + '%';
      svThumb.style.background = current;
      hueThumb.style.left = (hsv.h / 360 * 100) + '%';
      fresh.style.background = current;
      if (!fromHexField) hex.value = current;
      sheet.querySelectorAll('.hue-cp-chip').forEach(function (c) {
        c.classList.toggle('is-on', c.getAttribute('data-color') === current);
      });
    }

    function setHex(value) {
      var h = normHex(value);
      if (!h) return false;
      var keepHue = hsv.h;
      hsv = hexToHsv(h);
      if (hsv.s === 0) hsv.h = keepHue; // greys have no hue: keep the strip where it was
      return true;
    }

    function drag(el, onMove) {
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        var move = function (ev) {
          var r = el.getBoundingClientRect();
          onMove(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
          render();
        };
        move(e);
        var up = function () {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    }
    drag(sv, function (x, y) { hsv.s = x; hsv.v = 1 - y; });
    drag(hue, function (x) { hsv.h = Math.min(359.9, x * 360); });

    hex.addEventListener('input', function () {
      if (setHex(hex.value)) render(true);
    });
    hex.addEventListener('blur', function () { hex.value = current; });

    function chips(box, colors) {
      colors.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'hue-cp-chip';
        b.setAttribute('data-color', c);
        b.setAttribute('aria-label', c);
        b.style.background = c;
        b.addEventListener('click', function () { setHex(c); render(); });
        box.appendChild(b);
      });
    }
    chips(sheet.querySelector('.hue-cps-palette'), PALETTE);
    var rec = recent();
    if (rec.length) chips(sheet.querySelector('.hue-cps-recent'), rec);
    else sheet.querySelector('.hue-cps-recent-wrap').remove();

    function apply() {
      if (current !== start) {
        input.value = current.toLowerCase();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        remember(current);
      }
      close();
    }
    sheet.querySelector('[data-cps="done"]').addEventListener('click', apply);
    sheet.querySelector('[data-cps="cancel"]').addEventListener('click', close);
    sheet.querySelector('.hue-cps-backdrop').addEventListener('click', close);

    document.body.appendChild(sheet);
    render();
    requestAnimationFrame(function () { sheet && sheet.classList.add('open'); });
  }

  function close() {
    if (!sheet) return;
    var el = sheet;
    sheet = null;
    el.classList.remove('open');
    setTimeout(function () { el.remove(); }, 200);
  }

  // Every color field in the editor opens this sheet instead of the system dialog.
  document.addEventListener('click', function (e) {
    var input = e.target && e.target.closest ? e.target.closest('input[type="color"]') : null;
    if (!input) {
      // The swatch is drawn over the (invisible) input; taps can land on either.
      var wrap = e.target && e.target.closest ? e.target.closest('.color-swatch-wrap') : null;
      input = wrap && wrap.querySelector('input[type="color"]');
    }
    if (!input || input.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    open(input);
  }, true);

  window.__huevoColorPicker = { open: open, close: close, isOpen: function () { return !!sheet; } };
})();
