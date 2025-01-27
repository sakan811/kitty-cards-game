import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Phaser before any imports
const mockScale = {
    refresh: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
};

const mockGame = {
    scale: mockScale,
    config: null
};

// Create a mock window object
const mockWindow = {
    addEventListener: vi.fn()
};

// Store the real window object
const realWindow = global.window;

describe('Game', () => {
    beforeEach(async () => {
        // Clear all mocks and reset modules
        vi.clearAllMocks();
        vi.resetModules();
        
        // Setup global objects
        global.window = mockWindow;
        global.Phaser = {
            AUTO: 'AUTO',
            CANVAS: 'CANVAS',
            WEBGL: 'WEBGL',
            Game: vi.fn().mockImplementation(config => {
                mockGame.config = config;
                return mockGame;
            }),
            Scale: {
                RESIZE: 'RESIZE',
                CENTER_BOTH: 'CENTER_BOTH'
            },
            Scene: class Scene {
                constructor(config) {
                    this.config = config;
                }
            }
        };
        
        // Reset window mock
        mockWindow.addEventListener.mockClear();
        
        // Import game module fresh for each test
        await import('../../src/js/game.js');
    });

    afterEach(() => {
        // Restore the real window object
        global.window = realWindow;
        vi.restoreAllMocks();
    });

    it('should initialize Phaser game with correct config', async () => {
        const { gameConfig } = await import('../../src/js/config/gameConfig.js');
        expect(Phaser.Game).toHaveBeenCalledWith(gameConfig);
        expect(mockGame.config).toBe(gameConfig);
    });

    it('should include MainScene in game config', async () => {
        const { gameConfig } = await import('../../src/js/config/gameConfig.js');
        const { MainScene } = await import('../../src/js/scenes/MainScene.js');
        expect(gameConfig.scene).toBe(MainScene);
    });

    it('should handle window resize', async () => {
        // Verify that resize event listener was added
        expect(mockWindow.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
        
        // Get the resize handler function
        const resizeHandler = mockWindow.addEventListener.mock.calls[0][1];
        
        // Call the resize handler
        resizeHandler();
        
        // Check if scale.refresh was called
        expect(mockScale.refresh).toHaveBeenCalled();
    });
}); 