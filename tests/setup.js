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
        constructor() {
            this.sys = {
                settings: {
                    data: {}
                },
                game: {
                    scale: {
                        width: 800,
                        height: 600
                    }
                }
            };
            this.scale = {
                width: 800,
                height: 600
            };
            this.add = {
                sprite: vi.fn(() => ({
                    setOrigin: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    on: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setVisible: vi.fn().mockReturnThis()
                })),
                text: vi.fn(() => ({
                    setOrigin: vi.fn().mockReturnThis(),
                    setStyle: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setText: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setVisible: vi.fn().mockReturnThis()
                })),
                rectangle: vi.fn(() => ({
                    setStrokeStyle: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    on: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setVisible: vi.fn().mockReturnThis()
                })),
                container: vi.fn(() => ({
                    add: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setVisible: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                }))
            };
            this.scene = {
                start: vi.fn(),
                stop: vi.fn(),
                launch: vi.fn()
            };
            this.load = {
                image: vi.fn()
            };
            this.time = {
                delayedCall: vi.fn((delay, callback) => {
                    setTimeout(callback, delay);
                    return { destroy: vi.fn() };
                }),
                addEvent: vi.fn((config) => ({
                    destroy: vi.fn(),
                    remove: vi.fn()
                }))
            };
            this.mainContainer = this.add.container();
            this.waitingContainer = this.add.container();
            this.decks = {};
        }

        init(data) {
            if (data?.socket) {
                this.socket = data.socket;
                this.setupSocketListeners();
            }
        }

        setupSocketListeners() {
            if (this.socket) {
                this.socket.on('gameStart', () => this.startGame());
                this.socket.on('gameUpdate', (data) => this.handleGameUpdate(data));
                this.socket.on('playerLeft', () => this.handlePlayerLeft());
            }
        }

        handleOpponentAction(action, data) {
            if (action === 'cardPlayed') {
                console.log('Handling opponent action:', action, data);
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

// Mock room implementation for testing
export const mockRoom = {
    hasJoined: true,
    sessionId: 'test-player',
    id: 'test-room',
    connection: {
        isOpen: true,
        close: vi.fn()
    },
    state: {
        players: new Map(),
        tiles: Array(9).fill({ cupColor: 'white' }),
        currentPlayer: 'test-player',
        gameStarted: true
    },
    messageHandlers: new Map(),
    stateHandlers: [],
    errorHandlers: [],
    leaveHandlers: [],

    onMessage(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
        return this;
    },

    onStateChange(handler) {
        this.stateHandlers.push(handler);
        return this;
    },

    onError(handler) {
        this.errorHandlers.push(handler);
        return this;
    },

    onLeave(handler) {
        this.leaveHandlers.push(handler);
        return this;
    },

    send(event, data) {
        if (!this.hasJoined) {
            throw new Error('Room not connected');
        }
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
        return this;
    },

    leave() {
        this.hasJoined = false;
        this.leaveHandlers.forEach(handler => handler(4000));
        return Promise.resolve();
    },

    removeAllListeners() {
        this.messageHandlers.clear();
        this.stateHandlers = [];
        this.errorHandlers = [];
        this.leaveHandlers = [];
    },

    // Helper methods for testing
    simulateError(code, message) {
        this.errorHandlers.forEach(handler => handler(code, message));
    },

    simulateStateChange(newState) {
        this.stateHandlers.forEach(handler => handler(newState));
    },

    simulateMessage(event, data) {
        const handlers = this.messageHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }
};

// Export the mock room
export { mockRoom };

// Mock io constructor
global.io = vi.fn(() => mockSocketClient);

// Mock Server constructor
global.Server = vi.fn(() => mockSocketServer);

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