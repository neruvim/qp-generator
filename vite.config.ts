import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'Очередной лототрон', short_name: 'Очередной лототрон', lang: 'ru',
      description: 'Случайные номера. Без повторов. Даже без интернета.',
      theme_color: '#211135', background_color: '#170d26', display: 'standalone',
      start_url: './', scope: './',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'], cleanupOutdatedCaches: true },
  })],
});
