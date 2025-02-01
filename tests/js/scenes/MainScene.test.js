import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainScene } from '../../../src/js/scenes/MainScene.js';
import { CARD_DIMENSIONS, ASSET_KEYS } from '../../../src/js/config/constants.js';

describe('MainScene', () => {
    let scene;
    let mockSocket;
    let socketHandlers;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Store socket event handlers
        socketHandlers = {};
        
        mockSocket = {
            on: vi.fn((event, handler) => {
                socketHandlers[event] = socketHandlers[event] || [];
                socketHandlers[event].push(handler);
            }),
            emit: vi.fn(),
            id: 'player1'
        };

        scene = new MainScene();
        scene.socket = mockSocket;
        scene.roomId = 'test-room';
        scene.playerId = 'player1';
        scene.opponentId = 'player2';
        
        // Mock Phaser scene methods
        scene.add = {
            sprite: vi.fn(() => ({
                setDisplaySize: vi.fn().mockReturnThis(),
                setInteractive: vi.fn().mockReturnThis(),
                removeInteractive: vi.fn().mockReturnThis(),
                setOrigin: vi.fn().mockReturnThis(),
                destroy: vi.fn()
            })),
            container: vi.fn(() => ({
                add: vi.fn(),
                removeAll: vi.fn(),
                setDepth: vi.fn().mockReturnThis()
            })),
            rectangle: vi.fn(() => ({
                setAlpha: vi.fn().mockReturnThis(),
                setOrigin: vi.fn().mockReturnThis(),
                setDepth: vi.fn().mockReturnThis()
            })),
            text: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setText: vi.fn().mockReturnThis(),
                setDepth: vi.fn().mockReturnThis()
            }))
        };

        scene.scale = {
            width: 800,
            height: 600
        };

        scene.tweens = {
            add: vi.fn()
        };

        scene.make = {
            graphics: vi.fn(() => ({
                fillStyle: vi.fn(),
                fillRect: vi.fn(),
                lineStyle: vi.fn(),
                strokeRect: vi.fn(),
                generateTexture: vi.fn(),
                destroy: vi.fn()
            }))
        };

        // Initialize required properties
        scene.opponentHand = {
            numberStack: {
                container: scene.add.container(),
                count: 0
            },
            assistStack: {
                container: scene.add.container(),
                count: 0
            }
        };

        scene.updateOpponentStack = vi.fn();
        scene.updateOpponentHand = vi.fn();
        scene.setupSocketListeners();
    });

    afterEach(() => {
        vi.clearAllMocks();
        socketHandlers = {};
    });

    describe('Initialization', () => {
        it('should initialize with correct default properties', () => {
            const freshScene = new MainScene();
            expect(freshScene.socket).toBeNull();
            expect(freshScene.selectedCard).toBeNull();
            expect(freshScene.totalPoints).toBe(0);
            expect(freshScene.isPlayerTurn).toBe(false);
            expect(freshScene.playerId).toBeNull();
            expect(freshScene.opponentId).toBeNull();
            expect(freshScene.roomId).toBeNull();
        });

        it('should setup socket listeners correctly', () => {
            expect(mockSocket.on).toHaveBeenCalledWith('opponentAction', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('gameUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('turnUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('opponentHandUpdate', expect.any(Function));
        });
    });

    describe('Opponent Hand Management', () => {
        it('should update opponent hand counts correctly', () => {
            const handCount = { numberCount: 3, assistCount: 2 };
            
            // Trigger the opponentHandUpdate event handler
            socketHandlers.opponentHandUpdate.forEach(handler => 
                handler({ roomId: 'test-room', handCount })
            );

            expect(scene.opponentHand.numberStack.count).toBe(3);
            expect(scene.opponentHand.assistStack.count).toBe(2);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
        });

        it('should handle legacy single number hand count', () => {
            const handCount = 5;
            
            // Trigger the opponentHandUpdate event handler
            socketHandlers.opponentHandUpdate.forEach(handler => 
                handler({ roomId: 'test-room', handCount })
            );

            expect(scene.opponentHand.numberStack.count).toBe(5);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
        });
    });

    describe('Opponent Actions', () => {
        it('should handle opponent draw card action', () => {
            scene.handleOpponentAction('drawCard', {
                deckType: 'number',
                handCount: 4
            });

            expect(scene.opponentHand.numberStack.count).toBe(4);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
        });

        it('should handle opponent play card action', () => {
            scene.tiles = [{
                setNumber: vi.fn()
            }];

            scene.handleOpponentAction('playCard', {
                tileIndex: 0,
                cardValue: 5,
                handCount: 3
            });

            expect(scene.opponentHand.numberStack.count).toBe(3);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
            expect(scene.tiles[0].setNumber).toHaveBeenCalledWith(5);
        });
    });

    describe('Turn Management', () => {
        it('should handle turn updates correctly', () => {
            scene.updateTurnIndicator = vi.fn();
            scene.enableAllInteractions = vi.fn();
            scene.disableAllInteractions = vi.fn();

            // Trigger turnUpdate event for player turn
            socketHandlers.turnUpdate.forEach(handler => 
                handler({ roomId: 'test-room', currentPlayer: scene.playerId })
            );

            expect(scene.isPlayerTurn).toBe(true);
            expect(scene.updateTurnIndicator).toHaveBeenCalled();
            expect(scene.enableAllInteractions).toHaveBeenCalled();

            // Reset mocks for next test
            vi.clearAllMocks();
            scene.updateTurnIndicator = vi.fn();
            scene.enableAllInteractions = vi.fn();
            scene.disableAllInteractions = vi.fn();

            // Trigger turnUpdate event for opponent turn
            socketHandlers.turnUpdate.forEach(handler => 
                handler({ roomId: 'test-room', currentPlayer: scene.opponentId })
            );

            expect(scene.isPlayerTurn).toBe(false);
            expect(scene.updateTurnIndicator).toHaveBeenCalled();
            expect(scene.disableAllInteractions).toHaveBeenCalled();
        });
    });

    describe('Game State Updates', () => {
        it('should handle game state updates', () => {
            const gameState = {
                tiles: [{ value: 5 }],
                playerHand: [],
                opponentHandCounts: [{ playerId: 'player2', numberCount: 3, assistCount: 2 }],
                scores: { player1: 10 }
            };

            scene.renderTiles = vi.fn();
            scene.renderPlayerHand = vi.fn();
            scene.renderOpponentHands = vi.fn();
            scene.renderScores = vi.fn();
            scene.updateTurnIndicator = vi.fn();

            scene.renderGameState(gameState);

            expect(scene.renderTiles).toHaveBeenCalledWith(gameState.tiles);
            expect(scene.renderPlayerHand).toHaveBeenCalledWith(gameState.playerHand);
            expect(scene.renderOpponentHands).toHaveBeenCalledWith(gameState.opponentHandCounts);
            expect(scene.renderScores).toHaveBeenCalledWith(gameState.scores);
        });
    });
}); 