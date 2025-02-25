import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { GameClient } from '../../../src/js/services/GameClient';

describe('GameClient Connection', () => {
    let gameClient;

    beforeEach(() => {
        gameClient = new GameClient({
            serverUrl: 'http://localhost:3000'
        });
    });

    afterEach(() => {
        if (gameClient) {
            gameClient.disconnect();
        }
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should connect to local development server', async () => {
        // Mock successful connection
        const mockSocket = {
            connected: true,
            on: vi.fn(),
            once: vi.fn((event, callback) => {
                if (event === 'connect') {
                    callback();
                }
            }),
            connect: vi.fn(),
            emit: vi.fn()
        };

        vi.spyOn(gameClient, 'connect').mockResolvedValue();
        vi.spyOn(gameClient, 'getConnectionStatus').mockReturnValue(true);

        await gameClient.connect();
        expect(gameClient.getConnectionStatus()).toBe(true);
    });

    it('should handle server unavailability', async () => {
        // Mock connection failure
        const mockSocket = {
            connected: false,
            on: vi.fn(),
            once: vi.fn((event, callback) => {
                if (event === 'connect_error') {
                    callback(new Error('Connection failed'));
                }
            }),
            connect: vi.fn(),
            emit: vi.fn()
        };

        vi.spyOn(gameClient, 'connect').mockRejectedValue(new Error('Connection failed'));
        vi.spyOn(gameClient, 'getConnectionStatus').mockReturnValue(false);

        await expect(gameClient.connect()).rejects.toThrow('Connection failed');
        expect(gameClient.getConnectionStatus()).toBe(false);
    });
}); 