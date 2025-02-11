import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import gameClient from '../js/services/GameClient';
import GameScene from '../js/scenes/GameScene';
import Phaser from '../js/lib/phaser.js';
import { Room } from 'colyseus.js';

interface GameState {
    players: Map<string, Player>;
    currentPlayer: string;
    gameStarted: boolean;
}

interface Player {
    id: string;
    ready: boolean;
}

interface SceneData {
    room: Room;
    roomCode: string;
    playerId: string;
    currentTurn: string;
    gameState: GameState;
}

const Game: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameInstanceRef = useRef<Phaser.Game | null>(null);
    const navigate = useNavigate();
    const { gameState, setGameState } = useGame();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const room = gameClient.getRoom();
        
        if (!room || !gameState.roomCode) {
            console.log('Invalid game state or room connection');
            setError('Connection lost. Returning to lobby...');
            setTimeout(() => navigate('/lobby'), 2000);
            return;
        }

        let gameInstance: Phaser.Game | null = null;

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
                const config: Phaser.Types.Core.GameConfig = {
                    type: Phaser.AUTO,
                    width: 900,
                    height: 1600,
                    backgroundColor: '#2d2d2d',
                    parent: 'game',
                    scene: [], // Remove scene from config, we'll add it manually
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
                    }
                };

                // Create game instance
                gameInstance = new Phaser.Game(config);
                gameInstanceRef.current = gameInstance;

                // Wait for the game to be ready
                gameInstance.events.once('ready', () => {
                    // Prepare scene data
                    const sceneData: SceneData = {
                        room: room,
                        roomCode: gameState.roomCode!,
                        playerId: room.sessionId,
                        currentTurn: room.state.currentPlayer,
                        gameState: room.state
                    };
                    
                    console.log('Starting GameScene with data:', sceneData);
                    
                    // Add and start scene
                    if (!gameInstance?.scene.getScene('GameScene')) {
                        gameInstance?.scene.add('GameScene', GameScene, true, sceneData);
                    } else {
                        gameInstance?.scene.start('GameScene', sceneData);
                    }
                    
                    // Set up error handling
                    const gameScene = gameInstance?.scene.getScene('GameScene');
                    if (gameScene) {
                        gameScene.events.on('gameError', (errorMsg: string) => {
                            console.error('Game scene error:', errorMsg);
                            setError(errorMsg + ' Returning to lobby...');
                            setGameState(prev => ({ ...prev, isPlaying: false }));
                            setTimeout(() => navigate('/lobby'), 2000);
                        });
                    }
                    
                    setIsLoading(false);
                });

            } catch (error) {
                console.error('Failed to initialize game:', error);
                setError('Failed to start game. Returning to lobby...');
                setGameState(prev => ({ ...prev, isPlaying: false }));
                setTimeout(() => navigate('/lobby'), 2000);
            }
        };

        initGame();

        // Room event listeners
        const handleGameEnded = (message: { reason: string }) => {
            console.log('Game ended:', message);
            setError(message.reason + '. Returning to lobby...');
            setGameState(prev => ({ ...prev, isPlaying: false }));
            setTimeout(() => navigate('/lobby'), 2000);
        };

        const handleError = (code: number, message: string) => {
            setError(`Game error: ${message}`);
            setGameState(prev => ({ ...prev, isPlaying: false }));
            setTimeout(() => navigate('/lobby'), 2000);
        };

        room.onMessage('gameEnded', handleGameEnded);
        room.onError(handleError);

        // Clean up
        return () => {
            console.log('Cleaning up game instance');
            if (gameInstance) {
                try {
                    gameInstance.destroy(true);
                    gameInstanceRef.current = null;
                } catch (error) {
                    console.error('Error during game cleanup:', error);
                }
            }
            if (room) {
                room.removeAllListeners();
            }
        };
    }, [gameState.roomCode]);

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