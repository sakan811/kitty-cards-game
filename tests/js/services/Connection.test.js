import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import gameClient from '../../../src/js/services/GameClient';

describe('GameClient Connection', () => {
    beforeAll(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(async () => {
        await gameClient.disconnect();
        vi.restoreAllMocks();
    });

    const testConnection = async (endpoint) => {
        try {
            await gameClient.connect(endpoint);
            return true;
        } catch (error) {
            return false;
        }
    };

    it('should connect to local development server', async () => {
        const connected = await testConnection('ws://localhost:3000');
        expect(connected).toBeTruthy();
    });

    it('should handle server unavailability', async () => {
        const connected = await testConnection('ws://localhost:9999');
        expect(connected).toBeFalsy();
    });
}); 