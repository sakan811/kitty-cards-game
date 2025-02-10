import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../js/services/SocketService';
import { useGame } from '../context/GameContext';
import GameScene from '../js/scenes/GameScene';
import Phaser from '../js/lib/phaser.js';

const Game = () => {
  const gameContainerRef = useRef(null);
  const gameInstanceRef = useRef(null);
  const navigate = useNavigate();
  const { gameState } = useGame();
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
        
        // Create new game instance
        if (gameInstanceRef.current) {
          console.log('Destroying existing game instance');
          gameInstanceRef.current.destroy(true);
          gameInstanceRef.current = null;
        }

        // Configure game
        const config = {
          type: Phaser.AUTO,
          width: 900,
          height: 1600,
          backgroundColor: '#2d2d2d',
          parent: 'game',
          scene: GameScene,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 900,
            height: 1600,
            min: {
              width: 375,
              height: 667
            },
            max: {
              width: 1024,
              height: 1366
            }
          },
          dom: {
            createContainer: true
          },
          input: {
            disableContextMenu: false
          }
        };

        // Create game instance
        const game = new Phaser.Game(config);
        gameInstanceRef.current = game;

        // Wait for the game to be ready
        game.events.once('ready', () => {
          // Validate game state before starting scene
          if (!gameState.roomCode || !gameState.players) {
            console.error('Invalid game state:', gameState);
            setError('Invalid game state. Returning to lobby...');
            setTimeout(() => navigate('/lobby'), 2000);
            return;
          }

          // Start GameScene with initial data
          const sceneData = {
            socket,
            roomCode: gameState.roomCode,
            players: gameState.players,
            currentTurn: gameState.currentPlayer,
            playerId: socket.id,
            gameState: {
              currentPlayer: gameState.currentPlayer,
              players: gameState.players,
              tiles: gameState.tiles || [],
              decks: {
                assist: gameState.assistDeck || [],
                number: gameState.numberDeck || []
              }
            }
          };
          
          console.log('Starting GameScene with data:', sceneData);
          game.scene.start('GameScene', sceneData);
          setIsLoading(false);
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

    // Clean up
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
  }, [gameState.roomCode]); // Only reinitialize if room code changes

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
}

export default Game; 