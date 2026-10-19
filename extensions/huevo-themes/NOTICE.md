# huEVO Themes

Расширение **huEVO Themes 1.1.0**. Автор — **neriusshadow (huEVO SWAGdev)**.

- Страница в каталоге Firefox: https://addons.mozilla.org/ru/firefox/addon/swagdev-huevo-themes/
- Профиль автора на addons.mozilla.org: https://addons.mozilla.org/ru/firefox/user/20217851/
- Лицензия: [Mozilla Public License 2.0 (MPL-2.0)](LICENSE)

Файлы в этой папке — исходное расширение без изменений (кроме удалённой подписи `META-INF/`).
При сборке приложения `scripts/build-themes.mjs` вносит в них изменения (убирает эмодзи, правит подписи
и отключает два триггера звука); изменённые версии распространяются под той же лицензией MPL-2.0.

Адаптация под приложение лежит отдельно, в `src/themes/` (лицензия MIT, как и весь проект):

- `chrome-shim.js` — замена `chrome.storage` / `chrome.runtime` / `chrome.tabs` внутри WebView;
- `inject.js` — пункт «Темы оформления» в меню и шторка с редактором;
- `popup-head.js`, `popup-app.js`, `popup.mobile.css` — редактор в стиле huEVO;
- `color-picker.js` — выбор цвета вместо системного диалога Android;
- `app-overrides.js` — тема «Стандартная» и исправления читаемости.

В приложении отключены виджет часов и панель бокового меню (она рассчитана на компьютер).

Звуки в `sounds/` принадлежат их правообладателям (Discord, ICQ, Telegram, VK, Microsoft).
