/**
 * App tweaks to the extension's theme catalog (runs right after themes.js,
 * in the page and in the editor):
 * - "Стандартная" preset = the site without any theme, and it's the default;
 * - presets can't turn on the desktop-only sidebar panel.
 */
(function () {
  var T = window.HUEVO_THEMES;
  if (!T || !Array.isArray(T.PRESET_THEMES)) return;

  if (!T.PRESET_THEMES.some(function (p) { return p.id === 'standard'; })) {
    var base = T.DEFAULT_SETTINGS && T.DEFAULT_SETTINGS.customTheme ? T.DEFAULT_SETTINGS.customTheme : {};
    T.PRESET_THEMES.unshift({
      id: 'standard',
      name: 'Стандартная',
      category: 'classic',
      description: 'Оформление huEVO без изменений',
      colors: JSON.parse(JSON.stringify(base)),
      previewGradient: 'linear-gradient(135deg, #EDEEF0 0%, #EDEEF0 50%, #1E1F22 50%, #1E1F22 100%)'
    });
  }

  T.PRESET_THEMES.forEach(function (p) {
    if (p.effects) p.effects.sidebarCard = false;
  });

  /**
   * Readability fixes appended to every generated theme:
   * - the theme's link color rule (".theme-modern a:not(:hover)" etc.) out-ranks its own
   *   button rule, so buttons that are links (a.vk-btn, e.g. "Редактировать страницу")
   *   got link-colored text on the button background;
   * - badges (.hue-badge, .tab-badge) always had white text on the accent, unreadable on
   *   light accents, and the tab bar badge inside a link got the link color too.
   * The :not(#hq) chain only raises specificity above the theme's id-based selectors.
   */
  function readableOn(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#FFFFFF';
    var n = parseInt(m[1], 16);
    var lin = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
    // Pick whichever of white / near-black contrasts more with the background.
    return (1.05 / (L + 0.05)) >= ((L + 0.05) / (0.0072 + 0.05)) ? '#FFFFFF' : '#141416';
  }

  if (typeof T.generateThemeCss === 'function' && !T.generateThemeCss.__huevoApp) {
    var generate = T.generateThemeCss;
    T.generateThemeCss = function (settings) {
      var css = generate.apply(this, arguments);
      if (!css) return css;
      var c = (T.getActiveColors && T.getActiveColors(settings)) || {};
      var btnBg = c.buttonBg || c.accent;
      var btnText = c.buttonText || readableOn(btnBg);
      var badgeText = readableOn(c.accent);
      var hq = ':not(#hq1):not(#hq2):not(#hq3)';
      return css + '\n/* huevo-app: readability fixes */\n' +
        'html a.vk-btn' + hq + ', html a.vk-btn' + hq + ':visited, html a.vk-btn' + hq + ' * ' +
        '{ color: var(--huevo-btn-text, ' + btnText + ') !important; }\n' +
        'html .hue-badge' + hq + ', html .tab-badge' + hq + ', html a .hue-badge' + hq + ', html a .tab-badge' + hq + ' ' +
        '{ color: ' + badgeText + ' !important; }\n';
    };
    T.generateThemeCss.__huevoApp = true;
  }

  if (T.DEFAULT_SETTINGS) {
    T.DEFAULT_SETTINGS.activeThemeId = 'standard';
    // In the page nothing is applied until the user picks a theme.
    if (window === window.top) T.DEFAULT_SETTINGS.enabled = false;
  }
})();
