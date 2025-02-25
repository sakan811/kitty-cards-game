import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../../src/js/game';
import { mockRoom } from '../setup';
import { Room } from 'colyseus.js';
import { GameState } from '../../src/js/types/game';
import GameScene from '../../src/js/scenes/GameScene.ts';
import Phaser from '../../src/js/lib/phaser';
import { LobbyScene } from '../../src/js/scenes/LobbyScene';
import { MainScene } from '../../src/js/scenes/MainScene.js';
import config from '../../src/js/game';
import { PreloadScene } from '../../src/js/scenes/PreloadScene.js';

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

describe('Game Configuration', () => {
    it('should have correct basic configuration', () => {
        expect(config.type).toBe(Phaser.AUTO);
        expect(config.width).toBe(800);
        expect(config.height).toBe(600);
        expect(config.backgroundColor).toBe('#2d2d2d');
    });

    it('should have correct scene configuration', () => {
        expect(config.scene).toEqual([PreloadScene, LobbyScene, GameScene]);
    });

    it('should have correct scale configuration', () => {
        expect(config.scale.mode).toBe(Phaser.Scale.FIT);
        expect(config.scale.autoCenter).toBe(Phaser.Scale.CENTER_BOTH);
        expect(config.scale.width).toBe(800);
        expect(config.scale.height).toBe(600);
        expect(config.scale.min).toEqual({
            width: 375,
            height: 667
        });
        expect(config.scale.max).toEqual({
            width: 1024,
            height: 1366
        });
    });

    it('should have correct physics configuration', () => {
        expect(config.physics.default).toBe('arcade');
        expect(config.physics.arcade.debug).toBe(false);
    });

    it('should have correct audio configuration', () => {
        expect(config.audio.disableWebAudio).toBe(false);
        expect(config.audio.noAudio).toBe(false);
    });

    it('should have correct DOM configuration', () => {
        expect(config.dom.createContainer).toBe(true);
    });

    it('should have autoFocus disabled', () => {
        expect(config.autoFocus).toBe(false);
    });
}); 