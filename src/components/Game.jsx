import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../js/services/SocketService';
import { useGame } from '../context/GameContext';
import '../js/lib/phaser.js';  // Import Phaser first

const Game = () => {
  const gameContainerRef = useRef(null);
  const gameInstanceRef = useRef(null);
  const navigate = useNavigate();
  const { gameState, setGameState } = useGame();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const socket = socketService.getSocket();
    
    if (!socket || !socket.connected || !gameState.roomCode) {
      console.log('Invalid game state or socket connection');
      setError('Connection lost. Returning to lobby...');
      setTimeout(() => navigate('/lobby'), 2000);
      return;
    }

    // Initialize Phaser game
    const initGame = async () => {
      try {
        setIsLoading(true);
        const { default: gameConfig } = await import('../js/game');
        
        // Create new game instance
        if (gameInstanceRef.current) {
          console.log('Destroying existing game instance');
          gameInstanceRef.current.destroy(true);
          gameInstanceRef.current = null;
        }

        // Import and configure game
        const { Game: PhaserGame } = await import('phaser');
        gameInstanceRef.current = new PhaserGame({
          ...gameConfig,
          parent: 'game',
          scene: gameConfig.scene.map(Scene => new Scene()),
          callbacks: {
            postBoot: (game) => {
              // Start main scene with game state
              game.scene.start('MainScene', {
                socket,
                roomCode: gameState.roomCode,
                players: gameState.players,
                currentTurn: gameState.currentTurn
              });
              setIsLoading(false);
            }
          }
        });

      } catch (error) {
        console.error('Failed to initialize game:', error);
        setError('Failed to start game. Returning to lobby...');
        setTimeout(() => navigate('/lobby'), 2000);
      }
    };

    initGame();

    // Socket event listeners
    socket.on('disconnect', () => {
      setError('Connection lost. Returning to lobby...');
      setTimeout(() => navigate('/lobby'), 2000);
    });

    socket.on('gameError', (errorMsg) => {
      setError(errorMsg);
      setTimeout(() => navigate('/lobby'), 2000);
    });

    // Clean up on unmount
    return () => {
      if (gameInstanceRef.current) {
        console.log('Cleaning up game instance');
        try {
          gameInstanceRef.current.destroy(true);
          gameInstanceRef.current = null;
        } catch (error) {
          console.error('Error during game cleanup:', error);
        }
      }
      socket.off('disconnect');
      socket.off('gameError');
    };
  }, [navigate, gameState, setGameState]);

  return (
    <div className="game-container relative min-h-screen bg-gray-900">
      {error && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-red-500 text-white text-center">
          {error}
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-white text-xl">Loading game...</div>
        </div>
      )}
      <div id="game" ref={gameContainerRef} className="game-canvas" />
    </div>
  );
};

export default Game; 