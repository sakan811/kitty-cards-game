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
        scene.add = {
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
            }))
        };
        scene.scale = {
            width: 800,
            height: 600
        };
        scene.init({ socket: mockSocket });
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
            expect(mockSocket.on).toHaveBeenCalledWith('gameStart', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('gameUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('playerLeft', expect.any(Function));
        });
    });

    describe('Game Actions', () => {
        it('should handle opponent card played', () => {
            const cardData = {
                type: 'number',
                value: 5,
                x: 400,
                y: 300
            };
            
            scene.handleOpponentAction('cardPlayed', cardData);
            
            expect(scene.add.sprite).toHaveBeenCalledWith(
                cardData.x,
                cardData.y,
                'card'
            );
        });

        it('should emit game action when playing a card', () => {
            scene.isPlayerTurn = true;
            
            const mockCard = {
                type: 'number',
                value: 5,
                x: 400,
                y: 300,
                select: vi.fn(),
                deselect: vi.fn(),
                lift: vi.fn(),
                lower: vi.fn(),
                getData: vi.fn().mockReturnValue({
                    type: 'number',
                    value: 5,
                    x: 400,
                    y: 300
                })
            };
            
            scene.onCardClick(mockCard);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('gameAction', {
                action: 'cardPlayed',
                data: {
                    type: 'number',
                    value: 5,
                    x: 400,
                    y: 300
                }
            });
        });

        it('should not allow card play when not player turn', () => {
            scene.isPlayerTurn = false;
            
            const mockCard = {
                type: 'number',
                value: 5,
                deselect: vi.fn(),
                lower: vi.fn()
            };
            
            scene.onCardClick(mockCard);
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('Game Events', () => {
        it('should handle game over when opponent leaves', () => {
            const playerLeftCallback = mockSocket.on.mock.calls.find(
                call => call[0] === 'playerLeft'
            )[1];
            
            playerLeftCallback();
            
            expect(scene.add.text).toHaveBeenCalledWith(
                scene.scale.width / 2,
                scene.scale.height / 2,
                'Opponent left the game',
                expect.any(Object)
            );
        });

        it('should start game when receiving gameStart event', () => {
            scene.startGame = vi.fn();
            
            const gameStartCallback = mockSocket.on.mock.calls.find(
                call => call[0] === 'gameStart'
            )[1];
            
            gameStartCallback();
            expect(scene.startGame).toHaveBeenCalled();
        });
    });
}); 