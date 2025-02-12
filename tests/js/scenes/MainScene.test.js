import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GameScene from '../../../src/js/scenes/GameScene.ts';
import { CARD_DIMENSIONS, ASSET_KEYS } from '../../../src/js/config/constants.js';

describe('GameScene', () => {
    let scene;
    let mockSocket;
    let mockGameState;

    beforeEach(() => {
        mockSocket = {
            connected: true,
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn()
        };

        mockGameState = {
            roomCode: 'TEST123',
            players: [
                { id: 'player1', ready: true },
                { id: 'player2', ready: true }
            ],
            currentTurn: 'player1'
        };

        scene = new GameScene();
        scene.socket = mockSocket;
        scene.roomCode = mockGameState.roomCode;
        scene.players = mockGameState.players;
        scene.currentTurn = mockGameState.currentTurn;
    });

    describe('init', () => {
        it('should initialize with valid data', () => {
            const data = {
                socket: mockSocket,
                roomCode: mockGameState.roomCode,
                players: mockGameState.players,
                currentTurn: mockGameState.currentTurn
            };

            scene.init(data);

            expect(scene.socket).toBe(mockSocket);
            expect(scene.roomCode).toBe(mockGameState.roomCode);
            expect(scene.players).toEqual(mockGameState.players);
            expect(scene.currentTurn).toBe(mockGameState.currentTurn);
        });

        it('should return to lobby with invalid data', () => {
            scene.scene = { start: jest.fn() };
            scene.init({});

            expect(scene.scene.start).toHaveBeenCalledWith('LobbyScene');
        });
    });

    describe('create', () => {
        beforeEach(() => {
            scene.editorCreate = jest.fn();
            scene.boardManager = { createGameBoard: jest.fn() };
            scene.uiManager = { createUIElements: jest.fn(), setupButtonListeners: jest.fn() };
            scene.socket = { emit: jest.fn() };
        });

        it('should set up game correctly', () => {
            scene.create();

            expect(scene.editorCreate).toHaveBeenCalled();
            expect(scene.boardManager.createGameBoard).toHaveBeenCalled();
            expect(scene.uiManager.createUIElements).toHaveBeenCalled();
            expect(scene.socket.emit).toHaveBeenCalledWith('gameSceneReady', scene.roomCode);
        });
    });

    describe('game interactions', () => {
        beforeEach(() => {
            scene.turnManager = {
                onCardSelect: jest.fn(),
                onTileClick: jest.fn(),
                onEndTurnClick: jest.fn(),
                onExitClick: jest.fn()
            };
        });

        it('should handle card selection', () => {
            const card = { type: 'Card' };
            scene.onCardSelect(card);
            expect(scene.turnManager.onCardSelect).toHaveBeenCalledWith(card);
        });

        it('should handle tile clicks', () => {
            const tile = { type: 'Tile' };
            const tileIndex = 0;
            scene.onTileClick(tile, tileIndex);
            expect(scene.turnManager.onTileClick).toHaveBeenCalledWith(tile, tileIndex);
        });

        it('should handle end turn clicks', () => {
            scene.onEndTurnClick();
            expect(scene.turnManager.onEndTurnClick).toHaveBeenCalled();
        });

        it('should handle exit clicks', () => {
            scene.onExitClick();
            expect(scene.turnManager.onExitClick).toHaveBeenCalled();
        });
    });
}); 