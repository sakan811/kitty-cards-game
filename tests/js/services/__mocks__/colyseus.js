import { vi } from 'vitest';
import { mockRoom } from '../../../setup';

export const Client = vi.fn().mockImplementation(() => ({
    joinOrCreate: vi.fn().mockResolvedValue(mockRoom),
    joinById: vi.fn().mockResolvedValue(mockRoom),
    connection: {
        isOpen: true,
        close: vi.fn(),
        onerror: null
    }
})); 