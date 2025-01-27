// Setup test environment
import { vi } from 'vitest';

// Mock window methods
global.window.focus = vi.fn();

// Mock document methods
global.document.createElement = vi.fn((tag) => {
    if (tag === 'canvas') {
        const canvas = {
            getContext: vi.fn(),
            style: {},
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            width: 800,
            height: 600
        };
        return canvas;
    }
    return {};
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(callback => setTimeout(callback, 0));
global.cancelAnimationFrame = vi.fn();

// Mock performance.now()
global.performance.now = vi.fn(() => Date.now());

// Mock canvas methods
HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
    if (type === '2d') {
        return {
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn(() => ({
                data: new Array(4),
            })),
            putImageData: vi.fn(),
            createImageData: vi.fn(),
            setTransform: vi.fn(),
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            scale: vi.fn(),
            rotate: vi.fn(),
            translate: vi.fn(),
            transform: vi.fn(),
            fillText: vi.fn(),
            strokeText: vi.fn(),
            beginPath: vi.fn(),
            closePath: vi.fn(),
            lineTo: vi.fn(),
            moveTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
        };
    }
    
    if (type === 'webgl' || type === 'webgl2') {
        return {
            getExtension: vi.fn(),
            getParameter: vi.fn(),
            getShaderPrecisionFormat: vi.fn(() => ({
                precision: 1,
                rangeMin: 1,
                rangeMax: 1
            })),
            createShader: vi.fn(),
            createProgram: vi.fn(),
            createTexture: vi.fn(),
            bindTexture: vi.fn(),
            texImage2D: vi.fn(),
            texParameteri: vi.fn(),
            viewport: vi.fn(),
            clear: vi.fn(),
            clearColor: vi.fn(),
            enable: vi.fn(),
            disable: vi.fn(),
            blendFunc: vi.fn(),
            pixelStorei: vi.fn()
        };
    }
    return null;
}); 