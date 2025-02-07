import React, { createContext, useContext, useState } from 'react';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [game, setGame] = useState(null);
  const [currentScene, setCurrentScene] = useState(null);
  const [gameState, setGameState] = useState({
    isPlaying: false,
    roomCode: null,
    players: [],
    currentTurn: null,
  });

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

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
} 