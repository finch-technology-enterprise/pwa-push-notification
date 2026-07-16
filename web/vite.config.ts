import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'dist',
    assetsDir: 'static/media',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui-core': ['@mui/material', '@mui/system', '@mui/icons-material'],
          'vendor-mui-styles': ['@mui/material/styles', '@emotion/react', '@emotion/styled'],
          'vendor-dexie': ['dexie'],
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      strategies: 'injectManifest',
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['config.js'],
      },
      manifest: mode === 'development'
        ? {
            theme_color: '#317f6f',
            icons: [
              { src: '/static/images/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: '/static/images/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            ],
          }
        : false,
    }),
  ],
}))
