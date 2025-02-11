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

    beforeEach(() => {
        vi.clearAllMocks();
        gameClient = new GameClient();
        mockRoom.hasJoined = true;
        mockClient.connection.isOpen = true;
    });

    afterEach(async () => {
        if (gameClient) {
            await gameClient.disconnect();
        }
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
        beforeEach(async () => {
            await gameClient.connect();
            await gameClient.joinOrCreate();
        });

        it('should send messages when connected', () => {
            const sendSpy = vi.spyOn(mockRoom, 'send');
            gameClient.send('test', { data: 'test' });
            expect(sendSpy).toHaveBeenCalledWith('test', { data: 'test' });
        });

        it('should handle message sending when not connected', async () => {
            await gameClient.disconnect();
            expect(() => gameClient.send('test', {})).toThrow('Not connected to room');
        });

        it('should register and handle message listeners', () => {
            const handler = vi.fn();
            gameClient.on('test', handler);
            
            // Simulate message
            mockRoom.messageHandlers.get('test')?.forEach(h => h({ data: 'test' }));
            
            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should handle message listener errors gracefully', () => {
            const handler = () => { throw new Error('Handler error'); };
            const consoleSpy = vi.spyOn(console, 'error');
            
            gameClient.on('test', handler);
            mockRoom.messageHandlers.get('test')?.forEach(h => h({ data: 'test' }));
            
            expect(consoleSpy).toHaveBeenCalled();
        });
    });
}); 