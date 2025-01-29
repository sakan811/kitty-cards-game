import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainScene } from '../../../src/js/scenes/MainScene';

describe('MainScene', () => {
    let scene;
    let mockSocket;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockSocket = {
            on: vi.fn(),
            emit: vi.fn(),
            id: 'player1'
        };

        scene = new MainScene();
        scene.socket = mockSocket;
        scene.add = {
            text: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setStyle: vi.fn().mockReturnThis()
            })),
            sprite: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setInteractive: vi.fn().mockReturnThis()
            }))
        };
        scene.tiles = [];
        scene.decks = {
            playerDeck: {
                visual: {
                    setInteractive: vi.fn()
                }
            }
        };
        scene.updateTurnIndicator = vi.fn();
        scene.enableAllInteractions = vi.fn();
        scene.disableAllInteractions = vi.fn();
        scene.setupSocketListeners();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with correct properties', () => {
            const freshScene = new MainScene();
            expect(freshScene.socket).toBeNull();
            expect(freshScene.selectedCard).toBeNull();
            expect(freshScene.totalPoints).toBe(0);
            expect(freshScene.pointsText).toBeNull();
            expect(freshScene.isPlayerTurn).toBe(false);
            expect(freshScene.playerId).toBeNull();
            expect(freshScene.opponentId).toBeNull();
        });

        it('should setup socket connection on init', () => {
            expect(scene.socket).toBe(mockSocket);
            expect(mockSocket.on).toHaveBeenCalledWith('gameUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('turnUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('playerLeft', expect.any(Function));
        });
    });

    describe('Game Actions', () => {
        it('should handle opponent card played', () => {
            const cardData = {
                x: 400,
                y: 300,
                value: 5
            };
            
            scene.handleOpponentAction('cardPlayed', cardData);
            
            expect(scene.add.sprite).toHaveBeenCalledWith(
                cardData.x,
                cardData.y,
                'card'
            );
            console.log('Handling opponent action:', 'cardPlayed', cardData);
        });

        it('should emit game action when playing a card', () => {
            const card = {
                getData: vi.fn(() => ({
                    value: 5,
                    x: 400,
                    y: 300
                }))
            };
            scene.isPlayerTurn = true;
            scene.selectedCard = card;
            
            scene.onCardClick(card);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('gameAction', {
                action: 'cardPlayed',
                data: {
                    value: 5,
                    x: 400,
                    y: 300
                }
            });
        });

        it('should not allow card play when not player turn', () => {
            const card = {
                getData: vi.fn(() => ({
                    value: 5,
                    x: 400,
                    y: 300
                }))
            };
            scene.isPlayerTurn = false;
            scene.selectedCard = card;
            
            scene.onCardClick(card);
            
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('Game Events', () => {
        it('should handle game over when opponent leaves', () => {
            scene.handlePlayerLeft();
            
            expect(scene.add.text).toHaveBeenCalledWith(
                400,
                300,
                'Opponent left the game',
                expect.any(Object)
            );
        });

        it('should handle turn updates', () => {
            scene.decks = {
                number: { visual: { setInteractive: vi.fn() } },
                assist: { visual: { setInteractive: vi.fn() } }
            };
            
            scene.handleTurnUpdate({ isPlayerTurn: true });
            
            expect(scene.isPlayerTurn).toBe(true);
            expect(scene.decks.number.visual.setInteractive).toHaveBeenCalled();
            expect(scene.decks.assist.visual.setInteractive).toHaveBeenCalled();
            console.log('Handling turn update:', true);
        });
    });
}); 