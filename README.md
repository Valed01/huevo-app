# huEVO для Android

[![Android build](https://github.com/Valed01/huevo-app/actions/workflows/android.yml/badge.svg)](https://github.com/Valed01/huevo-app/actions/workflows/android.yml)

Неофициальный open-source клиент соцсети [huevo.su](https://huevo.su) на React Native + Expo.
Пока только Android.

> Это сторонний проект, не связанный с администрацией huEVO.

## Как устроено

Простая WebView-обёртка: приложение открывает https://huevo.su на весь экран с родным интерфейсом сайта
(включая его мобильный таб-бар). Сверху только то, чего не умеет вкладка браузера:

- системная кнопка «назад» листает историю сайта, на стартовой странице выходит из приложения;
- ссылки на другие сайты открываются во внешнем браузере;
- цвет системных панелей подстраивается под тему сайта (`<meta name="theme-color">`);
- экран ошибки с «Повторить», если нет сети; перезапуск WebView, если его процесс упал;
- к User-Agent добавлено `huEVOApp/<версия>`, чтобы админы видели трафик приложения.

```
src/
  app/_layout.tsx          корневой layout
  app/index.tsx            экран: системные панели + WebView
  components/site-webview.tsx
  lib/site.ts              адрес сайта, User-Agent, инжект для theme-color
```

## Запуск

Нужны Node 20+, JDK 17, Android SDK (или эмулятор/телефон с отладкой по USB).
Expo Go не подойдёт, потому что `react-native-webview` требует development build.

```bash
npm install
npm run android        # expo run:android: собрать и поставить dev build
```

Без локального Android SDK можно собрать в облаке: `npx eas-cli@latest build -p android --profile development`.

Проверки: `npm run typecheck && npm run lint`.

## Сборка в GitHub Actions

Каждый push в `main` собирает универсальный APK (arm64-v8a, x86_64), его можно скачать в артефактах запуска.
Тег `v*` (например, `git tag v0.1.0 && git push --tags`) дополнительно публикует APK в Releases.

Для подписи релизным ключом добавьте секреты репозитория: `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Без них APK подписан debug-ключом.

## Известные ограничения

- **Вход через Google** не работает внутри WebView: Google блокирует OAuth во встроенных браузерах.
  Используйте логин и пароль. Для Google-входа нужна поддержка на стороне сайта
  (например, редирект обратно в приложение по deep link).
- **Push-уведомлений нет**: у сайта нет push-сервера.

## Roadmap

- [ ] Иконка и сплэш huEVO (нужно согласие админов на логотип)
- [ ] Открытие ссылок `https://huevo.su/...` в приложении (deep links)
- [ ] Релизный ключ подписи

## Лицензия

MIT
