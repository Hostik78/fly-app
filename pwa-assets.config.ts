import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Генерирует все нужные иконки (favicon, apple-touch, PWA разных размеров,
// maskable) из одного исходного логотипа - public/logo-source.svg. Запускается
// один раз командой `npx pwa-assets-generator`, не часть обычной сборки -
// файлы-результаты сохраняются в public/ и коммитятся как обычные файлы.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo-source.svg'],
})
