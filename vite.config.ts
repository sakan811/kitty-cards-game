import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [
        react(),
        tsconfigPaths()
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
        target: 'esnext'
    },
    server: {
        port: 5173,
        proxy: {
            '/socket.io': {
                target: 'ws://localhost:3000',
                ws: true
            },
            '/colyseus': {
                target: 'ws://localhost:3000',
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
            'assets': path.resolve(__dirname, './src/assets')
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs']
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'phaser', 'colyseus.js']
    }
}); 