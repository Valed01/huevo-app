# 🦊 huEVO Themes для Mozilla Firefox

Специальная версия расширения для браузера Firefox с поддержкой `browser_specific_settings`, асинхронного `browser.*` WebExtensions API и готовым файлом сборки `.xpi`.

---

## 🚀 Способы установки в Firefox

### Способ 1: Быстрая загрузка через `about:debugging` (Рекомендуется для разработчиков и тестирования)

1. Откройте Firefox и введите в адресной строке:
   ```
   about:debugging#/runtime/this-firefox
   ```
   *(или перейдите в меню: Настройки -> Дополнения и темы -> значок шестерёнки ⚙️ -> «Отладка дополнений» -> «Этот Firefox»)*.

2. Нажмите кнопку **«Загрузить временное дополнение...»** (*Load Temporary Add-on...*).

3. Выберите файл манифеста:
   ```
   c:\Users\svinxtrik\Desktop\huEVO themes\firefox\manifest.json
   ```
   *(либо готовый файл `huevo-themes-firefox.xpi`)*.

4. Готово! Расширение мгновенно появится в панели инструментов.
5. Зайдите на **[https://huevo.departament.site](https://huevo.departament.site)** и наслаждайтесь темами!

---

### Способ 2: Установка `.xpi` (Firefox Developer Edition / Nightly)

Если вы используете **Firefox Developer Edition** или **Firefox Nightly**:
1. Перейдите в `about:config` и установите флаг `xpinstall.signatures.required` в `false`.
2. Перейдите в `about:addons`.
3. Нажмите на значок шестерёнки ⚙️ в правом верхнем углу и выберите **«Установить дополнение из файла...»** (*Install Add-on From File...*).
4. Выберите файл:
   ```
   c:\Users\svinxtrik\Desktop\huEVO themes\huevo-themes-firefox.xpi
   ```

---

## 📁 Содержимое папки `firefox/`

- `manifest.json` — адаптированный манифест с `gecko.id: "huevo-themes@departament.site"`
- `themes.js` — генератор тем оформления и пресетов
- `content.js` — внедрение стилей на движке Firefox WebExtension
- `content.css` — эффекты оверлеев (обои, сканлайны, снег)
- `popup.html` — всплывающее меню
- `popup.css` — стили интерфейса
- `popup.js` — управление настройками с поддержкой `browser.storage` и `browser.tabs`
- `icons/` — иконки 16, 32, 48, 128 px

---

*Created with SWAG by **neriusshadow huEVO SWAGdev** for the huEVO Community!*

