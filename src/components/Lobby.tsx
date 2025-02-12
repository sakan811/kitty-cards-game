import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import gameClient from '../js/services/GameClient';

interface Player {
    id: string;
    ready: boolean;
}

interface GameState {
    players: Map<string, Player>;
    gameStarted: boolean;
    hostId?: string;
    currentTurn?: string;
}

interface GameStartMessage {
    firstPlayer: string;
}

type ViewState = 'join' | 'waiting';

const Lobby: React.FC = () => {
    const navigate = useNavigate();
    const { setGameState } = useGame();
    const [view, setView] = useState<ViewState>('join');
    const [roomCode, setRoomCode] = useState<string>('');
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isConnected, setIsConnected] = useState<boolean>(false);
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

        const handleStateChange = (state: GameState) => {
            if (!state || !mountedRef.current) return;
            
            // Convert MapSchema to array and ensure no duplicates
            const playersList = Array.from(state.players.values())
                .filter((player): player is Player => player && typeof player.id === 'string')
                .filter((player, index, self) => 
                    index === self.findIndex(p => p.id === player.id)
                );
            
            setPlayers(playersList);
            
            // Update current player
            const current = playersList.find(p => p.id === playerId);
            if (mountedRef.current) {
                setCurrentPlayer(current || null);
            }
            
            // Check if all players are ready and game has started
            const allPlayersReady = playersList.length >= 2 && playersList.every(p => p.ready);
            const shouldStartGame = state.gameStarted && allPlayersReady && mountedRef.current;
            
            if (shouldStartGame && !navigatingToGame.current) {
                navigatingToGame.current = true;
                // Update game state before navigation
                setGameState(prev => ({
                    ...prev,
                    isPlaying: true,
                    players: playersList,
                    roomCode: room.id,
                    currentTurn: state.currentTurn || null
                }));
                // Use setTimeout to ensure state is updated before navigation
                setTimeout(() => {
                    if (mountedRef.current) {
                        handleNavigateToGame();
                    }
                }, 0);
            }
        };

        // Listen for game started event
        const handleGameStarted = (message: GameStartMessage) => {
            if (!mountedRef.current || navigatingToGame.current) return;
            
            console.log('Game started:', message);
            navigatingToGame.current = true;
            setGameState(prev => ({
                ...prev,
                isPlaying: true,
                currentTurn: message.firstPlayer,
                roomCode: room.id
            }));
            // Use setTimeout to ensure state is updated before navigation
            setTimeout(() => {
                if (mountedRef.current) {
                    handleNavigateToGame();
                }
            }, 0);
        };

        room.onMessage('gameStarted', handleGameStarted);
        room.onStateChange(handleStateChange);

        // Cleanup room listeners
        return () => {
            room.removeAllListeners();
        };
    }, [navigate, playerId, setGameState]);

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
            setGameState(prev => ({
                ...prev,
                roomCode: room.id,
                players: [{ id: room.sessionId, ready: false }]
            }));

            // Set up room state change listener
            room.onStateChange((state: GameState) => {
                if (!state) return;
                const playersList = Array.from(state.players.values());
                setPlayers(playersList);
                setGameState(prev => ({
                    ...prev,
                    players: playersList
                }));
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

            // Ensure we're connected first
            if (!isConnected) {
                await initializeConnection();
            }

            const room = await gameClient.joinById(roomCode);
            
            setPlayerId(room.sessionId);
            const playersList = Array.from(room.state.players.values()) as Player[];
            setPlayers(playersList);
            setView('waiting');
            setGameState(prev => ({
                ...prev,
                roomCode: room.id,
                players: playersList,
                hostId: room.state.hostId
            }));
        } catch (error) {
            console.error('Failed to join room:', error);
            setError(error instanceof Error ? error.message : 'Failed to join room. Please check the room code and try again.');
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
            room.send('ready');
        } catch (error) {
            console.error('Failed to send ready state:', error);
            setError('Failed to update ready state. Please try again.');
        }
    };

    const handleLeaveRoom = () => {
        gameClient.leave();
        setView('join');
        setRoomCode('');
        setPlayers([]);
        setGameState(prev => ({
            ...prev,
            roomCode: null,
            players: []
        }));
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
                <div className="lobby-menu">
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