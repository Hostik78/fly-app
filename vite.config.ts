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
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'FlyApp',
        short_name: 'FlyApp',
        description: 'FlyApp',
        // цвет фона при запуске (splash screen) и цвет строки состояния/адресной строки
        theme_color: '#e9edf3',
        background_color: '#e9edf3',
        // display: 'standalone' — открывается как отдельное приложение,
        // без адресной строки браузера, как обычное приложение с домашнего экрана
        display: 'standalone',
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
