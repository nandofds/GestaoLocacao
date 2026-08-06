import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['backroadie-logo.png', 'backroadie-icon.png'],
      manifest: {
        name: 'BackRoadie Gestão de Eventos',
        short_name: 'BackRoadie',
        description: 'Operação de locação de equipamentos para eventos',
        theme_color: '#071a36',
        background_color: '#f6f8fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/backroadie-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/backroadie-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ]
})
