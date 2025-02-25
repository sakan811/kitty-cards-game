import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        testTimeout: 10000,
        globals: true,
        css: true,
        deps: {
            inline: ['vitest-canvas-mock']
        }
    },
}); 