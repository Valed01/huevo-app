// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // src/themes and extensions/ are page scripts injected into the site (plain ES5).
    ignores: ['dist/*', 'extensions/**', 'src/themes/**'],
  },
]);
