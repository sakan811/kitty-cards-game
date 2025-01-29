// Mock Phaser
global.Phaser = {
    AUTO: 'AUTO',
    Game: class Game {
        constructor(config) {
            this.config = config;
            this.scale = {
                on: vi.fn(),
                refresh: vi.fn(),
                resize: vi.fn(),
                width: 800,
                height: 600
            };
            // Call scale.on('resize') during initialization
            this.scale.on('resize', () => {
                this.scale.refresh();
            });
        }
    },
    Scene: class Scene {
        constructor(config) {
            this.config = config;
            this.sys = {
                settings: { data: {} },
                game: {
                    config: {},
                    scale: {
                        width: 800,
                        height: 600
                    }
                }
            };
            this.add = {
                sprite: vi.fn(() => ({
                    setOrigin: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    on: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                })),
                text: vi.fn(() => ({
                    setOrigin: vi.fn().mockReturnThis(),
                    setStyle: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setText: vi.fn()
                })),
                rectangle: vi.fn(() => ({
                    setOrigin: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    on: vi.fn().mockReturnThis(),
                    setAlpha: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setStrokeStyle: vi.fn().mockReturnThis(),
                    setFillStyle: vi.fn().mockReturnThis()
                })),
                container: vi.fn(() => ({
                    add: vi.fn(),
                    setVisible: vi.fn(),
                    setPosition: vi.fn()
                }))
            };
            this.make = {
                graphics: vi.fn(() => ({
                    fillStyle: vi.fn().mockReturnThis(),
                    fillRect: vi.fn().mockReturnThis(),
                    lineStyle: vi.fn().mockReturnThis(),
                    strokeRect: vi.fn().mockReturnThis(),
                    generateTexture: vi.fn(),
                    destroy: vi.fn()
                }))
            };
            this.scene = {
                start: vi.fn(),
                stop: vi.fn(),
                launch: vi.fn()
            };
            this.scale = {
                width: 800,
                height: 600
            };
            this.load = {
                image: vi.fn()
            };
        }

        init(data) {
            if (data?.socket) {
                this.socket = data.socket;
                this.setupSocketListeners();
            }
        }

        setupSocketListeners() {
            this.socket.on('gameStart', () => this.startGame());
            this.socket.on('gameUpdate', (data) => this.handleGameUpdate(data));
            this.socket.on('playerLeft', () => this.handlePlayerLeft());
        }

        handleOpponentAction(action, data) {
            if (action === 'cardPlayed') {
                this.add.sprite(data.x, data.y, 'card');
            }
        }

        handlePlayerLeft() {
            this.add.text(
                this.scale.width / 2,
                this.scale.height / 2,
                'Opponent left the game',
                { fontSize: '32px', fill: '#fff' }
            );
        }

        startGame() {
            console.log('Game starting...');
        }

        preload() {}
        create() {}
        update() {}
    },
    Scale: {
        ScaleModes: {
            FIT: 'FIT',
            RESIZE: 'RESIZE'
        },
        CENTER_BOTH: 'CENTER_BOTH'
    }
};

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
    if (tag === 'input') {
        return {
            type: '',
            placeholder: '',
            value: '',
            style: {},
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            select: vi.fn(),
            readOnly: false
        };
    }
    return {};
});

// Mock document.execCommand for copy functionality
global.document.execCommand = vi.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(callback => setTimeout(callback, 0));
global.cancelAnimationFrame = vi.fn();

// Mock performance.now()
global.performance.now = vi.fn(() => Date.now());

// Mock Socket.IO
global.io = vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    id: 'test-socket-id'
}));

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