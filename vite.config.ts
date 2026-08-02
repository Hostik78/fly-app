import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // registerType: 'autoUpdate' — приложение само подхватывает новую версию
      // при следующем запуске, без ручного обновления пользователем
      registerType: 'autoUpdate',
      // strategies: 'injectManifest' — раньше service worker собирался автоматически
      // (generateSW) и не позволял дописать свою обработку событий. Push-уведомления
      // (Web Push) требуют именно СВОИХ обработчиков ('push', 'notificationclick') -
      // с generateSW их вставить было бы невозможно. injectManifest даёт свой файл
      // (src/sw.ts), куда список файлов для кеширования подставляется автоматически,
      // а остальное (обработчики push) пишется вручную.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Иконки/шрифты уже закешированы через обычный manifest ниже - не дублируем.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      includeAssets: ['logo-source.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        // name/short_name раньше были просто "FlyApp" - заготовка, которую никто не
        // менял. short_name - то, что видно под значком на экране Домой (должно быть
        // коротким), name - более полное имя (видно, например, при установке).
        name: 'Fly',
        short_name: 'Fly',
        description: 'Знакомства и общение с людьми рядом с вами в аэропорту',
        // По умолчанию плагин ставит "en" - весь текст в приложении на русском (см.
        // lang="ru" в index.html), манифест должен совпадать с реальным языком.
        lang: 'ru',
        // цвет фона при запуске (splash screen) и цвет строки состояния/адресной строки -
        // тёплый кремовый, как остальной новый дизайн (см. index.css, --color-fly-bg)
        theme_color: '#fff6f1',
        background_color: '#fff6f1',
        // display: 'standalone' — открывается как отдельное приложение,
        // без адресной строки браузера, как обычное приложение с домашнего экрана
        display: 'standalone',
        // Весь дизайн приложения - вертикальный (нижняя навигация, узкие карточки) -
        // в горизонтальной ориентации вёрстка выглядела бы сломанной, поэтому
        // фиксируем портретную ориентацию, а не полагаемся на случайный поворот.
        orientation: 'portrait',
        start_url: '/',
        id: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
