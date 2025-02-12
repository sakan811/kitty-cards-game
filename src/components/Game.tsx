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
    tiles: Array<{
        cupColor?: string;
        tileIndex?: number;
    }>;
}

interface Player {
    id: string;
    ready: boolean;
}

interface SceneData {
    room: Room<GameState>;
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
    const initializationRef = useRef<boolean>(false);

    useEffect(() => {
        const room = gameClient.getRoom();
        let cleanupStarted = false;
        let sceneInitialized = false;
        
        if (!room || !gameState.roomCode) {
            console.log('Invalid game state or room connection');
            setError('Connection lost. Returning to lobby...');
            setTimeout(() => navigate('/lobby'), 2000);
            return;
        }

        // Initialize Phaser game
        const initGame = async () => {
            // Prevent multiple initializations
            console.log('Checking initialization state...');
            if (initializationRef.current) {
                console.log('Game already initializing or initialized, skipping');
                return;
            }
            
            // Set initialization flag
            initializationRef.current = true;
            console.log('Starting game initialization...');

            try {
                setIsLoading(true);
                
                // Wait for room state to be ready and check if players are ready
                if (!room.state) {
                    console.log('Waiting for room state...');
                    await new Promise<void>((resolve) => {
                        const checkState = () => {
                            if (room.state) {
                                resolve();
                            }
                        };
                        room.onStateChange(checkState);
                        // Initial check
                        checkState();
                    });
                }

                // Check if all players are ready
                const players = Array.from(room.state.players.values()) as Player[];
                const allPlayersReady = players.every(player => player.ready);
                if (!allPlayersReady) {
                    console.log('Waiting for all players to be ready...');
                    await new Promise<void>((resolve) => {
                        const checkPlayers = () => {
                            const currentPlayers = Array.from(room.state.players.values()) as Player[];
                            const ready = currentPlayers.every(player => player.ready);
                            if (ready) {
                                resolve();
                            }
                        };
                        room.onStateChange(checkPlayers);
                        // Initial check
                        checkPlayers();
                    });
                }

                // Create new game instance
                if (gameInstanceRef.current) {
                    console.log('Cleaning up existing game instance');
                    gameInstanceRef.current.destroy(true);
                    gameInstanceRef.current = null;
                    // Wait a bit for cleanup to complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                if (cleanupStarted) {
                    console.log('Cleanup started during initialization, aborting');
                    return;
                }

                // Configure game
                const config: Phaser.Types.Core.GameConfig = {
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
                    }
                };

                // Create game instance
                console.log('Creating new game instance...');
                const gameInstance = new Phaser.Game(config);
                gameInstanceRef.current = gameInstance;

                // Wait for the game to be ready
                await new Promise<void>((resolve) => {
                    gameInstance.events.once('ready', resolve);
                });

                if (cleanupStarted) {
                    console.log('Cleanup started after game creation, aborting');
                    return;
                }

                // Get the game scene and initialize it properly
                const gameScene = gameInstance.scene.getScene('GameScene') as unknown as InstanceType<typeof GameScene>;
                if (!gameScene) {
                    throw new Error('Failed to get game scene');
                }

                try {
                    // Set up error handling first
                    gameScene.events.on('gameError', (errorMsg: string) => {
                        if (cleanupStarted) return;
                        console.error('Game scene error:', errorMsg);
                        setError(errorMsg + ' Returning to lobby...');
                        setGameState(prev => ({ ...prev, isPlaying: false }));
                        setTimeout(() => navigate('/lobby'), 2000);
                    });

                    // Prepare scene data
                    const sceneData = {
                        room: room,
                        roomCode: gameState.roomCode!,
                        playerId: room.sessionId,
                        currentTurn: room.state.currentPlayer,
                        gameState: room.state
                    };
                    
                    console.log('Preparing to start GameScene with data:', sceneData);

                    // Stop all scenes first
                    gameInstance.scene.scenes.forEach(scene => {
                        if (scene.scene.isActive()) {
                            scene.scene.stop();
                        }
                    });

                    // Wait a bit for scenes to stop
                    await new Promise<void>((resolve) => setTimeout(resolve, 100));

                    if (cleanupStarted) {
                        console.log('Cleanup started during scene stop, aborting');
                        return;
                    }

                    // Set up scene initialization promise before starting the scene
                    const initializationPromise = new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Scene initialization timeout'));
                        }, 5000);

                        // Listen for scene creation completion
                        gameScene.events.once('scene-awake', () => {
                            console.log('Scene awake event received');
                            clearTimeout(timeout);
                            resolve();
                        });
                    });

                    // Start the scene with data
                    console.log('Starting GameScene...');
                    gameInstance.scene.start('GameScene', sceneData);

                    // Wait for initialization to complete
                    await initializationPromise;
                    console.log('Scene initialization completed');

                    sceneInitialized = true;
                    setIsLoading(false);
                } catch (error) {
                    console.error('Failed to initialize game scene:', error);
                    throw error;
                }
            } catch (error) {
                console.error('Failed to initialize game:', error);
                if (!cleanupStarted) {
                    setError('Failed to start game. Returning to lobby...');
                    setGameState(prev => ({ ...prev, isPlaying: false }));
                    setTimeout(() => navigate('/lobby'), 2000);
                }
            }
        };

        initGame();

        // Clean up
        return () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            console.log('Starting cleanup process...');
            
            // Remove room listeners first
            if (room) {
                room.removeAllListeners();
            }

            // Then destroy game instance
            if (gameInstanceRef.current) {
                try {
                    const cleanup = async () => {
                        if (sceneInitialized) {
                            const gameScene = gameInstanceRef.current?.scene.getScene('GameScene');
                            if (gameScene) {
                                gameScene.events.removeAllListeners();
                            }
                        }
                        gameInstanceRef.current?.destroy(true);
                        gameInstanceRef.current = null;
                        // Reset initialization flag after cleanup
                        initializationRef.current = false;
                    };
                    cleanup();
                } catch (error) {
                    console.error('Error during game cleanup:', error);
                }
            } else {
                // Reset initialization flag if no game instance exists
                initializationRef.current = false;
            }
            
            console.log('Cleanup process completed');
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