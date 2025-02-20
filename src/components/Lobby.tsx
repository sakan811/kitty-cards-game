import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, GameState } from '../context/GameContext';
import { gameClient, RoomListing } from '../js/services/GameClient';
import type { Player } from '../js/types/game';

type ViewState = 'join' | 'waiting';

interface GameStartMessage {
    firstPlayer: string;
    turnOrder: string[];
}

const defaultGameState: GameState = {
    roomCode: null,
    players: [],
    hostId: undefined,
    gameStarted: false,
    currentTurn: undefined
};

const isValidGameState = (state: any): state is GameState => {
    return (
        typeof state === 'object' &&
        state !== null &&
        ('roomCode' in state || state.roomCode === null) &&
        Array.isArray(state.players) &&
        (state.hostId === undefined || typeof state.hostId === 'string') &&
        typeof state.gameStarted === 'boolean' &&
        (state.currentTurn === undefined || typeof state.currentTurn === 'string')
    );
};

const Lobby: React.FC = () => {
    const navigate = useNavigate();
    const { gameState, setGameState } = useGame();
    const [view, setView] = useState<ViewState>('join');
    const [roomCode, setRoomCode] = useState<string>('');
    const [players, setPlayers] = useState<Player[]>([]);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const mountedRef = useRef<boolean>(false);
    const navigatingToGame = useRef<boolean>(false);

    const initializeConnection = useCallback(async () => {
        if (!mountedRef.current) return;
        
        try {
            setIsLoading(true);
            setError(null);
            await gameClient.connect();
            if (mountedRef.current) {
                setIsConnected(true);
            }
        } catch (error) {
            if (mountedRef.current) {
                console.error('Failed to connect:', error);
                setError(error instanceof Error ? error.message : 'Failed to connect to server. Please check if the server is running.');
                setIsConnected(false);
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    // Handle component lifecycle
    useEffect(() => {
        console.log('Lobby mounted');
        mountedRef.current = true;

        // Setup connection only if not already connected
        const setupConnection = async () => {
            if (!gameClient.getConnectionStatus()) {
                try {
                    setIsLoading(true);
                    setError(null);
                    await gameClient.connect();
                    if (mountedRef.current) {
                        setIsConnected(true);
                    }
                } catch (error) {
                    console.error('Initial connection failed:', error);
                    if (mountedRef.current) {
                        setError(error instanceof Error ? error.message : 'Failed to connect to server');
                        setIsConnected(false);
                    }
                } finally {
                    if (mountedRef.current) {
                        setIsLoading(false);
                    }
                }
            } else {
                setIsConnected(true);
            }
        };

        setupConnection();

        // Cleanup function that runs before unmount
        return () => {
            mountedRef.current = false;
            // Only disconnect if we're not navigating to game
            if (!navigatingToGame.current && gameClient.getConnectionStatus()) {
                gameClient.disconnect();
            }
        };
    }, []); // Remove initializeConnection from dependencies

    // Set navigation flag before navigating
    const handleNavigateToGame = useCallback(() => {
        navigatingToGame.current = true;
        navigate('/game');
    }, [navigate]);

    // Handle room state
    useEffect(() => {
        const room = gameClient.getRoom();
        if (!room || !mountedRef.current) return;

        const handleStateChange = async (state: any) => {
            if (!state || !mountedRef.current) return;
            
            console.log('State change received:', state);
            
            // Convert players to array format regardless of input type
            let playersList: Player[];
            
            if (Array.isArray(state.players)) {
                // Check if the first element is an array (tuple) or an object
                const firstElement = state.players[0];
                if (Array.isArray(firstElement)) {
                    // Handle tuple format [id, player]
                    playersList = state.players.map((entry: any) => {
                        const [id, player] = entry;
                        return { ...player, id };
                    });
                } else {
                    // Handle object format { id, ...player }
                    playersList = state.players;
                }
            } else if (state.players instanceof Map) {
                playersList = Array.from(state.players.entries()).map((entry: any) => {
                    const [id, player] = entry;
                    return { ...player, id };
                });
            } else {
                playersList = Object.entries(state.players).map((entry: any) => {
                    const [id, player] = entry;
                    return { ...player, id };
                });
            }
            
            setPlayers(playersList);
            
            // Update current player
            const current = playersList.find(p => p.id === playerId);
            if (mountedRef.current) {
                setCurrentPlayer(current || null);
            }
            
            // Check if game should start
            const allPlayersReady = playersList.length >= 2 && playersList.every(p => p.ready);
            const shouldStartGame = state.isGameStarted && allPlayersReady;
            
            if (shouldStartGame && !navigatingToGame.current) {
                console.log('Game should start from state change, preparing navigation...');
                navigatingToGame.current = true;
                
                const room = gameClient.getRoom();
                if (!room) {
                    console.error('Failed to get room instance');
                    navigatingToGame.current = false;
                    setError('Failed to start game. Please try again.');
                    return;
                }
                
                // Update game state before navigation
                const newGameState = {
                    roomCode: room.id,
                    players: playersList,
                    hostId: state.hostId,
                    gameStarted: true,
                    currentTurn: state.currentTurn,
                    isPlaying: true
                };
                
                try {
                    // Update state and wait for it to complete
                    await new Promise<void>((resolve) => {
                        setGameState(newGameState);
                        // Give React a chance to update the state
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => resolve());
                        });
                    });
                    
                    console.log('Game state updated from state change, navigating to game...', newGameState);
                    handleNavigateToGame();
                } catch (error) {
                    console.error('Failed to update game state:', error);
                    navigatingToGame.current = false;
                    setError('Failed to start game. Please try again.');
                }
            }
        };

        // Listen for game started event
        const handleGameStarted = async (message: GameStartMessage) => {
            if (!mountedRef.current || navigatingToGame.current) return;
            
            console.log('Game started event received:', message);
            navigatingToGame.current = true;
            
            const room = gameClient.getRoom();
            if (!room) {
                console.error('Failed to get room instance');
                navigatingToGame.current = false;
                setError('Failed to start game. Please try again.');
                return;
            }
            
            const newGameState = {
                roomCode: room.id,
                players: players,
                hostId: undefined,
                gameStarted: true,
                currentTurn: message.firstPlayer,
                isPlaying: true
            };
            
            try {
                // Update state and wait for it to complete
                await new Promise<void>((resolve) => {
                    setGameState(newGameState);
                    // Give React a chance to update the state
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => resolve());
                    });
                });
                
                console.log('Game state updated, navigating to game...', newGameState);
                handleNavigateToGame();
            } catch (error) {
                console.error('Failed to update game state:', error);
                navigatingToGame.current = false;
                setError('Failed to start game. Please try again.');
            }
        };

        room.onMessage('gameStarted', handleGameStarted);
        room.onStateChange((state: {
            players: Array<Player | [string, Player]> | Map<string, Player> | { [key: string]: Player },
            currentTurn: string,
            isGameStarted: boolean,
            hostId?: string
        }) => {
            if (!state) return;
            
            // Convert players to array format regardless of input type
            let playersList: Player[];
            
            if (Array.isArray(state.players)) {
                // Check if the first element is an array (tuple) or an object
                const firstElement = state.players[0];
                if (Array.isArray(firstElement)) {
                    // Handle tuple format [id, player]
                    playersList = state.players.map((entry) => {
                        if (Array.isArray(entry)) {
                            const [id, player] = entry;
                            return { ...player, id };
                        }
                        return entry;
                    });
                } else {
                    // Handle object format { id, ...player }
                    playersList = state.players as Player[];
                }
            } else if (state.players instanceof Map) {
                playersList = Array.from(state.players.entries()).map((entry) => {
                    const [id, player] = entry;
                    return { ...player, id };
                });
            } else {
                playersList = Object.entries(state.players).map((entry) => {
                    const [id, player] = entry;
                    return { ...player, id };
                });
            }

            setPlayers(playersList);
            setGameState({
                roomCode: room.id,
                players: playersList,
                hostId: state.hostId,
                gameStarted: state.isGameStarted,
                currentTurn: state.currentTurn || undefined
            });
        });

        return () => {
            room.removeAllListeners();
        };
    }, [navigate, playerId, players, setGameState, handleNavigateToGame]);

    // Add retry connection button handler
    const handleRetryConnection = async () => {
        await initializeConnection();
    };

    const handleCreateRoom = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Ensure we're connected first
            if (!isConnected) {
                await initializeConnection();
            }

            const room = await gameClient.joinOrCreate('game_room');
            
            setRoomCode(room.id);
            setPlayerId(room.sessionId);
            setView('waiting');
            setGameState({
                roomCode: room.id,
                players: [{ id: room.sessionId, ready: false }],
                hostId: undefined,
                gameStarted: false,
                currentTurn: undefined
            });

            // Get the room instance
            const roomInstance = gameClient.getRoom();
            if (!roomInstance) {
                throw new Error('Failed to get room instance');
            }

            // Set up state change listener using Socket.IO events
            roomInstance.onStateChange((state: {
                players: Array<Player | [string, Player]> | Map<string, Player> | { [key: string]: Player },
                currentTurn: string,
                isGameStarted: boolean,
                hostId?: string
            }) => {
                if (!state) return;
                
                // Convert players to array format regardless of input type
                let playersList: Player[];
                
                if (Array.isArray(state.players)) {
                    // Check if the first element is an array (tuple) or an object
                    const firstElement = state.players[0];
                    if (Array.isArray(firstElement)) {
                        // Handle tuple format [id, player]
                        playersList = state.players.map((entry) => {
                            if (Array.isArray(entry)) {
                                const [id, player] = entry;
                                return { ...player, id };
                            }
                            return entry;
                        });
                    } else {
                        // Handle object format { id, ...player }
                        playersList = state.players as Player[];
                    }
                } else if (state.players instanceof Map) {
                    playersList = Array.from(state.players.entries()).map((entry) => {
                        const [id, player] = entry;
                        return { ...player, id };
                    });
                } else {
                    playersList = Object.entries(state.players).map((entry) => {
                        const [id, player] = entry;
                        return { ...player, id };
                    });
                }

                setPlayers(playersList);
                setGameState({
                    roomCode: room.id,
                    players: playersList,
                    hostId: state.hostId,
                    gameStarted: state.isGameStarted,
                    currentTurn: state.currentTurn || undefined
                });
            });

        } catch (error) {
            console.error('Failed to create room:', error);
            setError(error instanceof Error ? error.message : 'Failed to create room. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomCode) {
            setError('Please enter a room code');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            if (!isConnected) {
                await initializeConnection();
            }

            const availableRooms = await gameClient.getAvailableRooms();
            const roomExists = availableRooms.some((room: RoomListing) => room.roomId === roomCode);
            
            if (!roomExists) {
                throw new Error('Room does not exist or has ended');
            }

            const room = await gameClient.joinById(roomCode);
            
            setPlayerId(room.sessionId);
            setView('waiting');
            
            // Get the room instance
            const roomInstance = gameClient.getRoom();
            if (!roomInstance) {
                throw new Error('Failed to get room instance');
            }

            // Set up state change listener using Socket.IO events
            roomInstance.onStateChange((state: {
                players: Array<Player | [string, Player]> | Map<string, Player> | { [key: string]: Player },
                currentTurn: string,
                isGameStarted: boolean,
                hostId?: string
            }) => {
                if (!state) return;
                
                // Convert players to array format regardless of input type
                let playersList: Player[];
                
                if (Array.isArray(state.players)) {
                    // Check if the first element is an array (tuple) or an object
                    const firstElement = state.players[0];
                    if (Array.isArray(firstElement)) {
                        // Handle tuple format [id, player]
                        playersList = state.players.map((entry) => {
                            if (Array.isArray(entry)) {
                                const [id, player] = entry;
                                return { ...player, id };
                            }
                            return entry;
                        });
                    } else {
                        // Handle object format { id, ...player }
                        playersList = state.players as Player[];
                    }
                } else if (state.players instanceof Map) {
                    playersList = Array.from(state.players.entries()).map((entry) => {
                        const [id, player] = entry;
                        return { ...player, id };
                    });
                } else {
                    playersList = Object.entries(state.players).map((entry) => {
                        const [id, player] = entry;
                        return { ...player, id };
                    });
                }

                setPlayers(playersList);
                setGameState({
                    roomCode: room.id,
                    players: playersList,
                    hostId: state.hostId,
                    gameStarted: state.isGameStarted,
                    currentTurn: state.currentTurn || undefined
                });
            });

        } catch (error) {
            console.error('Failed to join room:', error);
            setError(error instanceof Error ? error.message : 'Failed to join room. Please check the room code and try again.');
            
            setRoomCode('');
            setPlayers([]);
            setGameState(defaultGameState);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReady = () => {
        const room = gameClient.getRoom();
        if (!room) {
            setError('Not connected to a room');
            return;
        }

        try {
            console.log('Sending ready event...');
            // Send ready event with callback to handle response
            room.send('ready', { roomId: room.id }, (response: any) => {
                console.log('Ready response received:', response);
                if (!response.success) {
                    console.error('Failed to update ready state:', response.error);
                    setError(response.error || 'Failed to update ready state. Please try again.');
                    return;
                }

                // Update local state immediately
                const currentPlayer = players.find(p => p.id === playerId);
                if (currentPlayer) {
                    const updatedPlayers = players.map(p => 
                        p.id === playerId ? { ...p, ready: response.ready } : p
                    );
                    setPlayers(updatedPlayers);
                    setCurrentPlayer({ ...currentPlayer, ready: response.ready });
                }

                // If game has started, handle navigation
                if (response.gameStarted && response.gameStartMessage) {
                    console.log('Game started from ready response:', response.gameStartMessage);
                    navigatingToGame.current = true;
                    const newGameState = {
                        roomCode: room.id,
                        players: response.state.players,
                        hostId: response.state.hostId,
                        gameStarted: true,
                        currentTurn: response.gameStartMessage.firstPlayer,
                        isPlaying: true
                    };
                    setGameState(newGameState);
                    // Navigate after a short delay to ensure state is updated
                    setTimeout(() => {
                        if (mountedRef.current) {
                            console.log('Navigating to game from ready response...');
                            handleNavigateToGame();
                        }
                    }, 100);
                } else if (response.state) {
                    // Handle regular state update
                    handleStateUpdate(response.state);
                }
            });
        } catch (error) {
            console.error('Failed to send ready state:', error);
            setError('Failed to update ready state. Please try again.');
        }
    };

    const handleStateUpdate = (state: any) => {
        if (!state) return;

        // Convert players array to proper format if needed
        const playersList = Array.isArray(state.players) 
            ? state.players 
            : Array.from(state.players.values());

        const newState = {
            roomCode: state.roomCode || roomCode || null,
            players: playersList,
            hostId: state.hostId,
            gameStarted: state.isGameStarted || false,
            currentTurn: state.currentTurn || undefined,
            isPlaying: state.isGameStarted || false
        };

        if (isValidGameState(newState)) {
            setGameState(newState);
            setPlayers(playersList);
            const current = playersList.find((p: Player) => p.id === playerId);
            if (current) {
                setCurrentPlayer(current);
            }
        }
    };

    const handleGameStart = (message: GameStartMessage) => {
        const newState = {
            ...gameState,
            gameStarted: true,
            currentTurn: message.firstPlayer
        };

        if (isValidGameState(newState)) {
            setGameState(newState);
            navigate('/game');
        }
    };

    const handleLeaveRoom = () => {
        gameClient.leave();
        setView('join');
        setRoomCode('');
        setPlayers([]);
        setGameState(defaultGameState);
    };

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">No Kitty Card Game</h1>

            {error && (
                <div className="lobby-error">
                    <span>{error}</span>
                    <div className="flex gap-2">
                        <button 
                            className="lobby-button lobby-button-gray"
                            onClick={() => setError(null)}
                        >
                            Dismiss
                        </button>
                        {!isConnected && (
                            <button 
                                className="lobby-button lobby-button-blue"
                                onClick={handleRetryConnection}
                            >
                                Retry Connection
                            </button>
                        )}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center p-8">
                    <div className="text-2xl text-white animate-pulse">Loading...</div>
                </div>
            ) : view === 'join' ? (
                <div className="lobby-menu">
                    <button 
                        className="lobby-button lobby-button-blue"
                        onClick={handleCreateRoom}
                    >
                        Create Room
                    </button>
                    <div className="flex flex-col gap-4">
                        <input
                            type="text"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            placeholder="Enter Room Code"
                            className="lobby-input"
                        />
                        <button 
                            className="lobby-button lobby-button-green"
                            onClick={handleJoinRoom}
                        >
                            Join Room
                        </button>
                    </div>
                </div>
            ) : (
                <div className="waiting-room">
                    <div className="lobby-room-info">
                        <h2 className="text-xl mb-2">Room Code:</h2>
                        <div className="flex items-center justify-center gap-2">
                            <span className="lobby-room-code">{roomCode}</span>
                            <button
                                className="lobby-copy-button"
                                onClick={() => {
                                    navigator.clipboard.writeText(roomCode);
                                    setError('Room code copied to clipboard!');
                                }}
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <div className="lobby-players-list">
                        <h2 className="text-xl mb-4">Players</h2>
                        {players && players.length > 0 ? (
                            players
                                .filter(player => player && player.id)
                                .map((player) => (
                                    <div key={player.id} className="lobby-player-item">
                                        <span>
                                            {player.id === playerId ? 'You' : 'Player 2'}
                                        </span>
                                        <span className={`lobby-player-status ${
                                            player.ready ? 'lobby-player-ready' : 'lobby-player-not-ready'
                                        }`}>
                                            {player.ready ? 'Ready' : 'Not Ready'}
                                        </span>
                                    </div>
                                ))
                        ) : (
                            <div className="text-gray-400">Waiting for players...</div>
                        )}
                    </div>

                    <div className="flex gap-4 mt-4">
                        <button 
                            className={`lobby-button ${currentPlayer?.ready ? 'lobby-button-red' : 'lobby-button-green'} flex-1`}
                            onClick={handleReady}
                        >
                            {currentPlayer?.ready ? 'Cancel Ready' : 'Ready'}
                        </button>
                        <button 
                            className="lobby-button lobby-button-gray flex-1"
                            onClick={handleLeaveRoom}
                        >
                            Leave Room
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Lobby;