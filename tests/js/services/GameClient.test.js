import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameClient } from '../../../src/js/services/GameClient';
import { Client } from 'colyseus.js';
import { mockRoom } from '../../setup';

// Mock the Client class
const mockClient = {
    joinOrCreate: vi.fn().mockResolvedValue(mockRoom),
    joinById: vi.fn().mockResolvedValue(mockRoom),
    connection: {
        isOpen: true,
        close: vi.fn()
    }
};

vi.mock('colyseus.js', () => ({
    Client: vi.fn(() => mockClient)
}));

describe('GameClient', () => {
    let gameClient;
    let mockSocket;

    beforeEach(() => {
        mockSocket = {
            connected: true,
            on: vi.fn(),
            once: vi.fn(),
            emit: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            removeAllListeners: vi.fn()
        };

        gameClient = new GameClient({
            serverUrl: 'http://localhost:3000'
        });

        // Mock socket.io-client
        vi.spyOn(gameClient, 'connect').mockResolvedValue();
        vi.spyOn(gameClient, 'getConnectionStatus').mockReturnValue(true);
    });

    afterEach(() => {
        if (gameClient) {
            gameClient.disconnect();
        }
        vi.clearAllMocks();
    });

    describe('Connection Management', () => {
        it('should connect successfully', async () => {
            await gameClient.connect();
            expect(gameClient.isConnected).toBe(true);
        });

        it('should not create new connection if already connected', async () => {
            await gameClient.connect();
            const firstClient = gameClient.client;
            await gameClient.connect();
            expect(gameClient.client).toBe(firstClient);
        });

        it('should handle connection failure', async () => {
            mockClient.connection.isOpen = false;
            
            // Mock setTimeout to execute immediately
            vi.useFakeTimers();
            
            const connectPromise = gameClient.connect();
            
            // Fast-forward timers
            vi.runAllTimers();
            
            await expect(connectPromise).rejects.toThrow('Connection timeout');
            expect(gameClient.isConnected).toBe(false);
            
            vi.useRealTimers();
        });

        it('should clean up existing connection before reconnecting', async () => {
            // First connection
            await gameClient.connect();
            
            // Create a new mock client for the second connection
            const mockClient2 = {
                ...mockClient,
                connection: { ...mockClient.connection }
            };
            
            // Mock the Client constructor for the second call
            const ClientMock = vi.mocked(Client);
            ClientMock.mockImplementationOnce(() => mockClient2);
            
            // Disconnect and reconnect
            await gameClient.disconnect();
            await gameClient.connect();
            
            expect(gameClient.client).not.toBe(mockClient);
        });
    });

    describe('Room Management', () => {
        beforeEach(async () => {
            await gameClient.connect();
        });

        it('should join room successfully', async () => {
            const room = await gameClient.joinOrCreate();
            expect(room).toBe(mockRoom);
            expect(gameClient.room).toBe(mockRoom);
        });

        it('should handle room join failure', async () => {
            mockClient.joinOrCreate.mockRejectedValueOnce(new Error('Failed to join room'));
            await expect(gameClient.joinOrCreate()).rejects.toThrow('Failed to join room');
        });

        it('should leave room properly', async () => {
            await gameClient.joinOrCreate();
            await gameClient.leave();
            expect(gameClient.room).toBeNull();
        });

        it('should handle disconnection while in room', async () => {
            await gameClient.joinOrCreate();
            await gameClient.disconnect();
            expect(gameClient.room).toBeNull();
            expect(gameClient.isConnected).toBe(false);
        });

        it('should attempt reconnection on abnormal closure', async () => {
            await gameClient.joinOrCreate();
            const reconnectSpy = vi.spyOn(gameClient, 'attemptReconnect');
            
            // Simulate abnormal closure
            mockRoom.leaveHandlers.forEach(handler => handler(4000));
            
            expect(reconnectSpy).toHaveBeenCalled();
        });

        it('should not attempt reconnection on normal closure', async () => {
            await gameClient.joinOrCreate();
            const reconnectSpy = vi.spyOn(gameClient, 'attemptReconnect');
            
            // Simulate normal closure
            mockRoom.leaveHandlers.forEach(handler => handler(1000));
            
            expect(reconnectSpy).not.toHaveBeenCalled();
        });
    });

    describe('Message Handling', () => {
        it('should send messages when connected', async () => {
            await gameClient.connect();
            
            const mockResponse = { success: true };
            mockSocket.emit.mockImplementation((event, data, callback) => {
                if (callback) callback(mockResponse);
            });

            const response = await new Promise((resolve) => {
                gameClient.getRoom()?.send('testEvent', { data: 'test' }, resolve);
            });

            expect(response).toEqual(mockResponse);
        });

        it('should handle message sending when not connected', async () => {
            vi.spyOn(gameClient, 'getConnectionStatus').mockReturnValue(false);
            
            const room = gameClient.getRoom();
            expect(room).toBeNull();
        });

        it('should register and handle message listeners', async () => {
            await gameClient.connect();
            
            const mockCallback = vi.fn();
            const room = gameClient.getRoom();
            room?.onMessage('testEvent', mockCallback);

            // Simulate receiving a message
            const mockData = { test: 'data' };
            mockSocket.on.mock.calls
                .find(([event]) => event === 'testEvent')[1](mockData);

            expect(mockCallback).toHaveBeenCalledWith(mockData);
        });

        it('should handle message listener errors gracefully', async () => {
            await gameClient.connect();
            
            const errorCallback = vi.fn();
            const room = gameClient.getRoom();
            room?.onMessage('error', errorCallback);

            // Simulate an error event
            const mockError = new Error('Test error');
            mockSocket.on.mock.calls
                .find(([event]) => event === 'error')[1](mockError);

            expect(errorCallback).toHaveBeenCalledWith(mockError);
        });
    });
}); 