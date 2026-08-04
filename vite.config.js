import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'Lume Gestão de Eventos',
                short_name: 'Lume',
                description: 'Operação de locação de equipamentos para eventos',
                theme_color: '#071a36',
                background_color: '#f6f8fb',
                display: 'standalone',
                start_url: '/',
                icons: [
                    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
                ]
            },
            workbox: {
                navigateFallback: '/index.html',
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
            }
        })
    ]
});
