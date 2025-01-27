import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        threads: false,
        isolate: false,
        deps: {
            inline: ['phaser']
        }
    }
}); 