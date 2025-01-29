import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LobbyScene } from '../../../src/js/scenes/LobbyScene';

describe('LobbyScene', () => {
    let scene;
    let mockSocket;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock socket
        mockSocket = {
            on: vi.fn(),
            emit: vi.fn(),
            id: 'test-socket-id'
        };

        // Mock global.io
        global.io = vi.fn(() => mockSocket);

        // Create scene with mocked Phaser functionality
        scene = new LobbyScene();

        // Mock containers that are created in create()
        scene.mainContainer = {
            setVisible: vi.fn(),
            add: vi.fn()
        };
        
        scene.waitingContainer = {
            setVisible: vi.fn(),
            add: vi.fn(),
            removeAll: vi.fn(),
            list: []
        };
        
        // Mock Phaser.Scene methods and properties
        scene.add = {
            text: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setStyle: vi.fn().mockReturnThis(),
                setInteractive: vi.fn().mockReturnThis(),
                disableInteractive: vi.fn().mockReturnThis(),
                setText: vi.fn().mockReturnThis(),
                destroy: vi.fn().mockReturnThis(),
                on: vi.fn().mockReturnThis()
            })),
            container: vi.fn(() => scene.waitingContainer),
            rectangle: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setInteractive: vi.fn().mockReturnThis(),
                setFillStyle: vi.fn().mockReturnThis(),
                disableInteractive: vi.fn().mockReturnThis(),
                on: vi.fn().mockReturnThis(),
                setAlpha: vi.fn().mockReturnThis()
            })),
            dom: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                node: { value: 'test-room' }
            }))
        };

        scene.scene = {
            start: vi.fn()
        };

        scene.time = {
            delayedCall: vi.fn()
        };

        // Initialize scene
        scene.init();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Socket Connection', () => {
        it('should connect to socket server on init', () => {
            expect(global.io).toHaveBeenCalledWith('http://localhost:3000');
            expect(scene.socket).toBe(mockSocket);
        });

        it('should setup required socket event listeners', () => {
            const expectedEvents = [
                'roomCreated',
                'joinedRoom',
                'playerJoined',
                'roomError',
                'playerReady',
                'gameStart',
                'playerLeft',
                'connect_error'
            ];

            expectedEvents.forEach(event => {
                expect(mockSocket.on).toHaveBeenCalledWith(event, expect.any(Function));
            });
        });
    });

    describe('Room Management', () => {
        it('should emit createRoom event when creating a room', () => {
            scene.createRoom();
            expect(mockSocket.emit).toHaveBeenCalledWith('createRoom');
        });

        it('should update scene state when room is created', () => {
            const roomData = {
                roomId: 'test-room',
                playerId: 'player-1',
                players: [{ id: 'player-1' }]
            };

            scene.handleRoomCreated(roomData);
            
            // Verify state updates
            expect(scene.currentRoomId).toBe(roomData.roomId);
            expect(scene.playerId).toBe(roomData.playerId);
            
            // Verify UI updates
            expect(scene.mainContainer.setVisible).toHaveBeenCalledWith(false);
            expect(scene.waitingContainer.setVisible).toHaveBeenCalledWith(true);
            expect(scene.waitingContainer.removeAll).toHaveBeenCalled();
        });

        it('should update scene state when joining a room', () => {
            const roomData = {
                roomId: 'test-room',
                playerId: 'player-2',
                players: [
                    { id: 'player-1' },
                    { id: 'player-2' }
                ]
            };

            scene.handleJoinedRoom(roomData);
            
            // Verify state updates
            expect(scene.currentRoomId).toBe(roomData.roomId);
            expect(scene.playerId).toBe(roomData.playerId);
            
            // Verify UI updates
            expect(scene.mainContainer.setVisible).toHaveBeenCalledWith(false);
            expect(scene.waitingContainer.setVisible).toHaveBeenCalledWith(true);
        });

        it('should display error message when room error occurs', () => {
            const errorMsg = 'Room is full';
            scene.handleRoomError(errorMsg);
            expect(scene.add.text).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Number),
                errorMsg,
                expect.any(Object)
            );
        });
    });

    describe('Game Flow', () => {
        it('should transition to MainScene when game starts', () => {
            const gameData = {
                roomId: 'test-room',
                players: [
                    { id: 'player-1', ready: true },
                    { id: 'player-2', ready: true }
                ],
                gameState: { deck: [] },
                currentTurn: 'player-1'
            };

            scene.currentRoomId = gameData.roomId;
            
            // Get and call the gameStart handler
            const gameStartHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'gameStart'
            )[1];
            
            gameStartHandler(gameData);

            // Verify scene transition
            expect(scene.scene.start).toHaveBeenCalledWith('MainScene', {
                socket: mockSocket,
                roomId: gameData.roomId,
                playerId: scene.playerId,
                players: gameData.players,
                gameState: gameData.gameState,
                currentTurn: gameData.currentTurn
            });
        });

        it('should handle player disconnection', () => {
            const disconnectData = {
                roomId: 'test-room',
                players: [{ id: 'player-1' }]
            };

            scene.currentRoomId = disconnectData.roomId;
            
            // Get and call the playerLeft handler
            const playerLeftHandler = mockSocket.on.mock.calls.find(
                call => call[0] === 'playerLeft'
            )[1];
            
            playerLeftHandler(disconnectData);

            // Verify error message is shown
            expect(scene.add.text).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Number),
                'Other player left the game',
                expect.any(Object)
            );

            // Verify delayed reload is scheduled
            expect(scene.time.delayedCall).toHaveBeenCalledWith(
                3000,
                expect.any(Function)
            );
        });
    });
}); 