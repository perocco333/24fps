import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/24fps/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'fonts/ZenMaruGothic-Bold.ttf',
      ],
      manifest: {
        name: 'コマ計算機',
        short_name: 'コマ計算',
        description: '24fpsアニメ用の秒＋コマ加減算計算機',
        theme_color: '#cfcfcf',
        background_color: '#cfcfcf',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ja',
        start_url: '/24fps/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
        navigateFallback: '/24fps/index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 43124,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43124,
    strictPort: true,
  },
})
