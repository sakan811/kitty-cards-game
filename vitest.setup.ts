import { vi } from 'vitest';
import { createCanvas } from 'canvas';
import 'vitest-canvas-mock';

// Define WebGL context interface
interface MockWebGLContext {
    getExtension: () => null;
    getParameter: () => null;
    getShaderPrecisionFormat: () => {
        precision: number;
        rangeMin: number;
        rangeMax: number;
    };
}

// Mock canvas for Phaser
const originalGetContext = global.HTMLCanvasElement.prototype.getContext;
global.HTMLCanvasElement.prototype.getContext = function(contextType: string, contextAttributes?: any): any {
    if (contextType === 'webgl' || contextType === 'webgl2') {
        return {
            getExtension: () => null,
            getParameter: () => null,
            getShaderPrecisionFormat: () => ({
                precision: 1,
                rangeMin: 1,
                rangeMax: 1
            })
        } as MockWebGLContext;
    }
    if (contextType === '2d') {
        return createCanvas(300, 150).getContext('2d');
    }
    return null;
};

// Mock window properties used by Phaser
Object.defineProperty(window, 'devicePixelRatio', { value: 1 });

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    return setTimeout(callback, 0);
};

// Mock cancelAnimationFrame
global.cancelAnimationFrame = (handle: number): void => {
    clearTimeout(handle);
};

// Mock Audio
class MockAudio {
    src?: string;
    constructor(src?: string) {
        this.src = src;
    }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

// Add missing HTMLAudioElement properties
Object.defineProperties(MockAudio.prototype, {
    autoplay: { value: false, writable: true },
    buffered: { value: { length: 0 }, writable: false },
    duration: { value: 0, writable: true },
    currentTime: { value: 0, writable: true },
    paused: { value: true, writable: true },
    volume: { value: 1, writable: true }
});

global.Audio = MockAudio as any;

// Mock WebSocket for socket.io-client
class MockWebSocket {
    onopen: ((event: any) => void) | null = null;
    onclose: ((event: any) => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;

    constructor(url?: string) {}
    send(data: any) {}
    close(code?: number, reason?: string) {}
}

global.WebSocket = MockWebSocket as any; 