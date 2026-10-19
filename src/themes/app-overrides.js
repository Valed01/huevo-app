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

  if (T.DEFAULT_SETTINGS) {
    T.DEFAULT_SETTINGS.activeThemeId = 'standard';
    // In the page nothing is applied until the user picks a theme.
    if (window === window.top) T.DEFAULT_SETTINGS.enabled = false;
  }
})();
