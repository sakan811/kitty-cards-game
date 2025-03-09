import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        react(),
        tsconfigPaths(),
        nodePolyfills({
            include: ['events']
        }),
        tailwindcss()
    ],
    root: 'src',
    base: '/',
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        copyPublicDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'src/index.html')
            },
            output: {
                assetFileNames: (assetInfo) => {
                    if (!assetInfo.name) return 'assets/[name][extname]';
                    
                    const info = assetInfo.name.split('.');
                    const extType = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
                        const pathSegments = assetInfo.name.split('/');
                        const fileName = pathSegments[pathSegments.length - 1];
                        const folderName = pathSegments[pathSegments.length - 2] || '';
                        return `assets/${folderName}/${fileName}`;
                    }
                    return `assets/[name][extname]`;
                },
                chunkFileNames: 'js/[name]-[hash].js',
                entryFileNames: 'js/[name]-[hash].js'
            }
        },
        sourcemap: true,
        target: 'esnext',
        commonjsOptions: {
            include: [/events/],
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/socket.io': {
                target: 'ws://localhost:8000',
                ws: true
            }
        },
        hmr: {
            overlay: true
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'assets': path.resolve(__dirname, './src/assets'),
            events: 'events',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs']
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'events'],
        esbuildOptions: {
            define: {
                global: 'globalThis'
            }
        }
    }
}); 