import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GameScene from '../../../src/js/scenes/GameScene.ts';
import { mockRoom } from '../../setup';

describe('GameScene', () => {
    let scene;

    beforeEach(() => {
        scene = new GameScene();
        scene.add = {
            text: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                destroy: vi.fn()
            })),
            container: vi.fn(),
            image: vi.fn().mockReturnThis(),
            rectangle: vi.fn().mockReturnThis()
        };
        scene.tweens = {
            add: vi.fn()
        };
        scene.cameras = {
            main: {
                centerX: 400,
                centerY: 300
            }
        };
    });

    it('should initialize correctly with valid data', () => {
        const data = {
            room: mockRoom,
            roomCode: 'test-room',
            playerId: 'test-player',
            currentTurn: 'test-player',
            gameState: {
                tiles: Array(9).fill({ cupColor: 'white' }),
                players: new Map()
            }
        };

        scene.init(data);

        expect(scene.socket).toBe(mockRoom);
        expect(scene.roomCode).toBe('test-room');
        expect(scene.playerId).toBe('test-player');
        expect(scene.isInitialized).toBe(true);
    });

    it('should emit error on invalid data', () => {
        const events = {
            emit: vi.fn()
        };
        scene.events = events;

        scene.init({});

        expect(events.emit).toHaveBeenCalledWith('gameError', 'Invalid game data');
    });

    it('should send ready message when created', () => {
        const data = {
            room: mockRoom,
            roomCode: 'test-room',
            playerId: 'test-player',
            currentTurn: 'test-player',
            gameState: {
                tiles: Array(9).fill({ cupColor: 'white' }),
                players: new Map()
            }
        };

        scene.init(data);
        scene.create();

        expect(mockRoom.send).toHaveBeenCalledWith('gameSceneReady');
    });

    it('should handle game updates correctly', () => {
        const data = {
            room: mockRoom,
            roomCode: 'test-room',
            playerId: 'test-player',
            currentTurn: 'test-player',
            gameState: {
                tiles: Array(9).fill({ cupColor: 'white' }),
                players: new Map()
            }
        };

        scene.init(data);

        const gameState = {
            currentPlayer: 'test-player',
            tiles: Array(9).fill({ cupColor: 'white' })
        };

        scene.handleGameUpdate({
            type: 'gameState',
            gameState
        });

        expect(scene.currentTurn).toBe('test-player');
        expect(scene.isPlayerTurn).toBe(true);
    });
}); 