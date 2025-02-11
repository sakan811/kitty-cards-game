import React, { createContext, useContext, useState } from 'react';

interface Player {
    id: string;
    ready: boolean;
}

interface GameState {
    isPlaying: boolean;
    roomCode: string | null;
    players: Player[];
    currentTurn: string | null;
    hostId?: string;
}

interface GameContextType {
    game: any | null;
    setGame: React.Dispatch<React.SetStateAction<any | null>>;
    currentScene: string | null;
    setCurrentScene: React.Dispatch<React.SetStateAction<string | null>>;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const defaultGameState: GameState = {
    isPlaying: false,
    roomCode: null,
    players: [],
    currentTurn: null
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
    const [game, setGame] = useState<any | null>(null);
    const [currentScene, setCurrentScene] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState>(defaultGameState);

    const value = {
        game,
        setGame,
        currentScene,
        setCurrentScene,
        gameState,
        setGameState,
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame(): GameContextType {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
} 