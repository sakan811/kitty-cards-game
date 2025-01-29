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
            sprite: vi.fn(),
            container: vi.fn(() => ({
                add: vi.fn(),
                removeAll: vi.fn()
            })),
            rectangle: vi.fn(() => ({
                setAlpha: vi.fn().mockReturnThis()
            })),
            text: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis()
            })),
            graphics: vi.fn()
        };
        scene.tweens = {
            add: vi.fn()
        };
        scene.tiles = [{
            setNumber: vi.fn()
        }];
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
        scene.opponentHand = {
            numberStack: {
                container: {
                    removeAll: vi.fn(),
                    add: vi.fn()
                },
                count: 0
            },
            assistStack: {
                container: {
                    removeAll: vi.fn(),
                    add: vi.fn()
                },
                count: 0
            }
        };
        scene.updateOpponentStack = vi.fn();
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
        test('should handle opponent card played', () => {
            const scene = new MainScene();
            scene.tiles = [{ setNumber: vi.fn() }];
            scene.opponentHand = {
                numberStack: { count: 3 },
                assistStack: { count: 0 }
            };
            scene.updateOpponentHand = vi.fn();

            const cardData = {
                tileIndex: 0,
                cardValue: 5,
                handCount: 2  // Server reports one less card after playing
            };

            scene.handleOpponentAction('playCard', cardData);

            expect(scene.tiles[0].setNumber).toHaveBeenCalledWith(5);
            expect(scene.opponentHand.numberStack.count).toBe(2);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
        });

        test('should handle opponent drawing a number card', () => {
            const scene = new MainScene();
            scene.opponentHand = {
                numberStack: { count: 2 },
                assistStack: { count: 0 }
            };
            scene.updateOpponentHand = vi.fn();

            const drawData = {
                deckType: 'number',
                handCount: 3  // Server reports new total
            };

            scene.handleOpponentAction('drawCard', drawData);

            expect(scene.opponentHand.numberStack.count).toBe(3);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
        });

        test('should handle opponent playing assist card', () => {
            const scene = new MainScene();
            scene.opponentHand = {
                numberStack: { count: 2 },
                assistStack: { count: 2 }
            };
            scene.updateOpponentHand = vi.fn();

            const assistData = {
                handCount: 1  // Server reports one less assist card
            };

            scene.handleOpponentAction('playAssistCard', assistData);

            expect(scene.opponentHand.assistStack.count).toBe(1);
            expect(scene.updateOpponentHand).toHaveBeenCalled();
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