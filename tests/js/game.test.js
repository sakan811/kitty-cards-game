import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LobbyScene } from '../../src/js/scenes/LobbyScene.js';
import { MainScene } from '../../src/js/scenes/MainScene.js';

describe('Game', () => {
    let game;

    beforeEach(() => {
        vi.clearAllMocks();
        const gameConfig = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            backgroundColor: '#ffffff',
            parent: 'game-container',
            dom: {
                createContainer: true
            },
            scale: {
                mode: Phaser.Scale.ScaleModes.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            },
            scene: [LobbyScene, MainScene]
        };
        game = new Phaser.Game(gameConfig);
    });

    afterEach(() => {
        vi.clearAllMocks();
        game = null;
    });

    it('should initialize with correct config', () => {
        expect(game.config).toEqual(expect.objectContaining({
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            backgroundColor: '#ffffff',
            parent: 'game-container',
            dom: {
                createContainer: true
            },
            scale: expect.objectContaining({
                mode: Phaser.Scale.ScaleModes.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }),
            scene: [LobbyScene, MainScene]
        }));
    });

    it('should include both scenes', () => {
        expect(game.config.scene).toEqual([LobbyScene, MainScene]);
    });

    it('should setup window resize handler', () => {
        expect(game.scale.on).toHaveBeenCalledWith('resize', expect.any(Function));
    });
}); 