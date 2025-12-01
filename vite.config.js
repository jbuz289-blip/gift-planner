import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Gift Planner',
        short_name: 'GiftPlan',
        description: 'AI-Powered Family Gift Planning',
        theme_color: '#b91c1c',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'https://placehold.co/192x192/b91c1c/ffffff?text=GP',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://placehold.co/512x512/b91c1c/ffffff?text=GP',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
});