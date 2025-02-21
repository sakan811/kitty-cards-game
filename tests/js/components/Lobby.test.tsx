import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Lobby from '../../../src/components/Lobby';
import { gameClient } from '../../../src/js/services/GameClient';
import { GameProvider } from '../../../src/context/GameContext';

// Mock the gameClient
vi.mock('../../../src/js/services/GameClient', () => ({
    gameClient: {
        connect: vi.fn().mockResolvedValue(undefined),
        joinOrCreate: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        getRoom: vi.fn(),
        disconnect: vi.fn()
    }
}));

describe('Lobby Room Creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock successful connection by default
        (gameClient.connect as any).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const renderLobby = () => {
        return render(
            <MemoryRouter>
                <GameProvider>
                    <Lobby />
                </GameProvider>
            </MemoryRouter>
        );
    };

    it('should handle successful room creation', async () => {
        // Mock successful room creation
        const mockRoom = {
            id: 'test-room-123',
            sessionId: 'player-1',
            onStateChange: vi.fn(),
            onMessage: vi.fn(),
            connection: { isOpen: true },
            removeAllListeners: vi.fn()
        };
        (gameClient.joinOrCreate as any).mockResolvedValue(mockRoom);
        (gameClient.getRoom as any).mockReturnValue(mockRoom);

        renderLobby();

        // Wait for the component to be ready
        await waitFor(() => {
            expect(screen.getByText('Create Room')).toBeDefined();
        });

        // Click create room button
        const createButton = screen.getByText('Create Room');
        fireEvent.click(createButton);

        // Verify successful room creation
        await waitFor(() => {
            expect(gameClient.joinOrCreate).toHaveBeenCalledWith('game_room');
            expect(screen.getByText('Room Code:')).toBeDefined();
            expect(screen.getByText(mockRoom.id)).toBeDefined();
        });
    });

    it('should handle null server response when creating room', async () => {
        // Mock server sending null response
        (gameClient.joinOrCreate as any).mockRejectedValue(new Error('Server sent null response'));
        (gameClient.getRoom as any).mockReturnValue(null);

        renderLobby();

        // Wait for the component to be ready
        await waitFor(() => {
            expect(screen.getByText('Create Room')).toBeDefined();
        });

        // Click create room button
        const createButton = screen.getByText('Create Room');
        fireEvent.click(createButton);

        // Verify error handling
        await waitFor(() => {
            expect(screen.getByText('Server sent null response')).toBeDefined();
        });
    });

    it('should handle server error response when creating room', async () => {
        // Mock server sending error response
        (gameClient.joinOrCreate as any).mockRejectedValue(new Error('Invalid room type'));
        (gameClient.getRoom as any).mockReturnValue(null);

        renderLobby();

        // Wait for the component to be ready
        await waitFor(() => {
            expect(screen.getByText('Create Room')).toBeDefined();
        });

        // Click create room button
        const createButton = screen.getByText('Create Room');
        fireEvent.click(createButton);

        // Verify error handling
        await waitFor(() => {
            expect(screen.getByText('Invalid room type')).toBeDefined();
        });
    });

    it('should handle server timeout when creating room', async () => {
        // Mock server timeout
        (gameClient.joinOrCreate as any).mockRejectedValue(new Error('Server response timeout'));
        (gameClient.getRoom as any).mockReturnValue(null);

        renderLobby();

        // Wait for the component to be ready
        await waitFor(() => {
            expect(screen.getByText('Create Room')).toBeDefined();
        });

        // Click create room button
        const createButton = screen.getByText('Create Room');
        fireEvent.click(createButton);

        // Verify error handling
        await waitFor(() => {
            expect(screen.getByText('Server response timeout')).toBeDefined();
        });
    });
}); 