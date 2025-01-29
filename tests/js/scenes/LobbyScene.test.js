import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LobbyScene } from '../../../src/js/scenes/LobbyScene';

// Mock Socket.IO
const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
};

// Mock global io function
global.io = vi.fn(() => mockSocket);

describe('LobbyScene', () => {
    let scene;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Create a new scene instance
        scene = new LobbyScene();
        
        // Mock Phaser.Scene methods and properties
        scene.add = {
            container: vi.fn(() => ({
                add: vi.fn(),
                setVisible: vi.fn(),
                setPosition: vi.fn()
            })),
            rectangle: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setInteractive: vi.fn().mockReturnThis(),
                on: vi.fn(),
                setAlpha: vi.fn()
            })),
            text: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setStyle: vi.fn().mockReturnThis(),
                setPosition: vi.fn().mockReturnThis(),
                setInteractive: vi.fn().mockReturnThis(),
                on: vi.fn(),
                setText: vi.fn()
            })),
            dom: vi.fn(() => ({
                setOrigin: vi.fn().mockReturnThis(),
                setPosition: vi.fn().mockReturnThis(),
                addListener: vi.fn(),
                setInteractive: vi.fn().mockReturnThis()
            }))
        };
        scene.time = {
            delayedCall: vi.fn()
        };
        scene.scene = {
            start: vi.fn()
        };
        scene.scale = {
            width: 800,
            height: 600
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with correct properties', () => {
        expect(scene.socket).toBeNull();
        expect(scene.roomInput).toBeNull();
        expect(scene.mainContainer).toBeNull();
        expect(scene.waitingContainer).toBeNull();
    });

    it('should connect to socket server on init', () => {
        scene.init();
        expect(global.io).toHaveBeenCalledWith('http://localhost:3000');
        expect(scene.socket).toBe(mockSocket);
    });

    it('should setup socket listeners', () => {
        scene.init();
        expect(mockSocket.on).toHaveBeenCalledWith('roomCreated', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('joinedRoom', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('playerJoined', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('roomError', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('should create room when createRoom is called', () => {
        scene.init();
        scene.createRoom();
        expect(mockSocket.emit).toHaveBeenCalledWith('createRoom');
    });

    it('should show room code when room is created', () => {
        scene.init();
        scene.create();
        const roomId = 'test-room-id';
        
        // Get the roomCreated callback
        const roomCreatedCallback = mockSocket.on.mock.calls.find(call => call[0] === 'roomCreated')[1];
        
        // Call the callback with the room ID
        roomCreatedCallback(roomId);
        
        // Check if containers are properly toggled
        expect(scene.mainContainer.setVisible).toHaveBeenCalledWith(false);
        expect(scene.waitingContainer.setVisible).toHaveBeenCalledWith(true);
    });

    it('should start MainScene when joining room', () => {
        scene.init();
        const roomId = 'test-room-id';
        
        // Get the joinedRoom callback
        const joinedRoomCallback = mockSocket.on.mock.calls.find(call => call[0] === 'joinedRoom')[1];
        
        // Call the callback with the room ID
        joinedRoomCallback(roomId);
        
        // Check if scene transition occurs
        expect(scene.scene.start).toHaveBeenCalledWith('MainScene', { socket: mockSocket });
    });

    it('should show error when room join fails', () => {
        scene.init();
        const error = 'Room is full';
        
        // Get the roomError callback
        const roomErrorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'roomError')[1];
        
        // Call the callback with the error
        roomErrorCallback(error);
        
        // Check if error is displayed
        expect(scene.add.text).toHaveBeenCalledWith(
            expect.any(Number),
            expect.any(Number),
            error,
            expect.any(Object)
        );
    });

    it('should start MainScene when second player joins', () => {
        scene.init();
        const players = [{ id: '1' }, { id: '2' }];
        
        // Get the playerJoined callback
        const playerJoinedCallback = mockSocket.on.mock.calls.find(call => call[0] === 'playerJoined')[1];
        
        // Call the callback with two players
        playerJoinedCallback(players);
        
        // Check if scene transition occurs
        expect(scene.scene.start).toHaveBeenCalledWith('MainScene', { socket: mockSocket });
    });
}); 