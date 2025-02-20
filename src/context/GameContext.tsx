import React, { createContext, useContext, useState } from 'react';
import type { Player } from '../js/types/game';

export interface GameState {
    roomCode: string | null;
    players: Player[];
    hostId?: string;
    gameStarted?: boolean;
    currentTurn?: string;
    isPlaying?: boolean;
}

interface GameContextType {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const defaultGameState: GameState = {
    roomCode: null,
    players: [],
    hostId: undefined,
    gameStarted: false,
    currentTurn: undefined,
    isPlaying: false
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>(defaultGameState);

    return (
        <GameContext.Provider value={{ gameState, setGameState }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};

export default GameContext; 