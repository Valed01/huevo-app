// Assembles the huEVO Themes extension (extensions/huevo-themes) plus the app
// adapters (src/themes) into native assets, served to the WebView at
// https://huevo.su/__huevo_themes__/ by modules/huevo-themes (AssetServer.kt).
//
// Runs on `npm install` (postinstall); re-run with `npm run themes` after edits.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ext = join(root, 'extensions/huevo-themes');
const adapters = join(root, 'src/themes');
const out = join(root, 'modules/huevo-themes/android/src/main/assets/huevo-themes');

if (!existsSync(ext)) {
  console.log('build-themes: extensions/huevo-themes not found, skipping');
  process.exit(0);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const SKIP = new Set(['manifest.json', 'NOTICE.md', 'README_FIREFOX.md']);
cpSync(ext, out, { recursive: true, filter: (src) => !SKIP.has(src.split('/').pop()) });
for (const f of ['chrome-shim.js', 'popup-head.js', 'popup-app.js', 'color-picker.js', 'app-overrides.js', 'popup.mobile.css']) {
  cpSync(join(adapters, f), join(out, f));
}

const read = (p) => readFileSync(p, 'utf8');

// Content script bundle, evaluated by the app at document start (see THEMES_LOADER in src/lib/site.ts).
// Same order as the extension manifest: content.css, then themes.js and content.js.
// At document start <html> may not exist yet, so wait for it before adding the stylesheet.
const cssLink = `(function () {
  function add() {
    var root = document.head || document.documentElement;
    if (!root) return false;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = location.origin + '/__huevo_themes__/content.css';
    root.appendChild(l);
    return true;
  }
  if (!add()) {
    new MutationObserver(function (m, obs) { if (add()) obs.disconnect(); })
      .observe(document, { childList: true, subtree: true });
  }
})();`;
// Each part is isolated so one failing script doesn't stop the others.
const part = (name, code) => `try {\n${code}\n} catch (e) { console.error('[huevo-themes] ${name}:', e); }`;
// content.js has two fallback sound triggers that misfire in the app: a DOM observer that
// treats every message row added to the page as a new message (opening a chat renders its
// whole history) and a bell-badge poll. The theme sound stays on the site's own signal
// (its hueSounds.play, which fires only for genuinely new events), which content.js hooks.
const CONTENT_PATCHES = [
  ['    initDomNotificationObserver();\n', '    // initDomNotificationObserver(); (disabled in the app)\n'],
  ['    startBadgeCheckInterval();\n', '    // startBadgeCheckInterval(); (disabled in the app)\n'],
];
let content = read(join(ext, 'content.js'));
for (const [from, to] of CONTENT_PATCHES) {
  if (!content.includes(from)) throw new Error(`build-themes: content.js changed, patch not applied: ${from.trim()}`);
  content = content.split(from).join(to);
}

const bundle = [
  part('chrome-shim', read(join(adapters, 'chrome-shim.js'))),
  part('content.css', cssLink),
  part('themes.js', read(join(ext, 'themes.js'))),
  part('app-overrides', read(join(adapters, 'app-overrides.js'))),
  part('content.js', content),
  part('inject', read(join(adapters, 'inject.js'))),
].join('\n');
writeFileSync(join(out, 'content-bundle.js'), bundle);

// The editor UI uses plain text labels in the app: drop decorative emoji (keeps the ✓ and ✕ glyphs).
const EMOJI = /(?:[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}]|(?![\u2713\u2715])[\u2600-\u27BF])[\uFE0F\u200D]*[ \u00A0]?/gu;
const stripEmoji = (text) => text.replace(EMOJI, '');

// Mobile wording: no drag and drop, and text instead of icon-only buttons.
const COPY = [
  ['btnDl.textContent = "📥";', 'btnDl.textContent = "Экспорт";'],
  ['btnDel.textContent = "✕";', 'btnDel.textContent = "Удалить";'],
  ['Кликните на цветной квадрат для выбора цвета (с пипеткой):', 'Нажмите на квадратик, чтобы выбрать цвет.'],
  ['statusText.textContent = "Готово"', 'statusText.textContent = "Включены"'],
  ['statusText.textContent = "Откл"', 'statusText.textContent = "Выключены"'],
  ['Перетащите видео сюда (MP4 / WebM)', 'Выбрать видео'],
  ['или нажмите для выбора видеофайла', 'MP4 или WebM'],
  ['Перетащите картинку сюда', 'Выбрать картинку'],
  ['Перетащите файл сюда', 'Выбрать файл'],
  ['или нажмите для выбора (PNG, JPG, WebP, GIF, MP4)', 'PNG, JPG, WebP, GIF или MP4'],
  ['или нажмите для выбора (PNG, JPG, WebP, GIF)', 'PNG, JPG, WebP или GIF'],
];
const recopy = (text) => COPY.reduce((t, [from, to]) => t.split(from).join(to), text);

writeFileSync(join(out, 'popup.js'), stripEmoji(recopy(read(join(ext, 'popup.js')))));

// Editor page: the extension's popup with the chrome.* shim and the mobile skin.
let popup = stripEmoji(recopy(read(join(ext, 'popup.html'))));
const css = '<link rel="stylesheet" href="popup.css">';
if (!popup.includes(css) || !popup.includes('<script src="themes.js"></script>')) {
  throw new Error('build-themes: popup.html layout changed, update the injection points');
}
popup = popup
  .replace(css, `${css}\n  <link rel="stylesheet" href="popup.mobile.css">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <script src="popup-head.js"></script>`)
  .replace('<script src="themes.js"></script>',
    '<script src="chrome-shim.js"></script>\n  <script src="popup-app.js"></script>\n  <script src="color-picker.js"></script>\n  <script src="themes.js"></script>\n  <script src="app-overrides.js"></script>');
writeFileSync(join(out, 'popup.html'), popup);

console.log(`build-themes: ${out}`);
