import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'Quad — Campus Marketplace',
        short_name: 'Quad',
        description: 'The student-only marketplace. Verified with your college email, picked up between classes.',
        theme_color: '#07070A',
        background_color: '#07070A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Don't precache the Cloudinary-hosted images — they're huge and
        // change constantly. Only precache the app shell.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  // QD-029 — Split vendor code from app code so cached vendor chunks
  // survive an app-code deploy (better cache hit rate, faster page loads).
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes rarely.
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation + icons — bundled because they're imported everywhere
          // and changing one would invalidate the whole chunk otherwise.
          'vendor-ui': ['framer-motion', 'lucide-react', 'sonner'],
          // i18n — splits out the heavy locale data.
          'vendor-i18n': ['i18next', 'react-i18next'],
          // Socket.io — independent of React.
          'vendor-socket': ['socket.io-client']
        }
      }
    }
  }
});
