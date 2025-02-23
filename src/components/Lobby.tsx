import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LobbyClient } from 'boardgame.io/client';
import { useGame } from '../context/GameContext';

const GAME_NAME = 'no-kitty-cards-game';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface Player {
    id: string;
    name: string;
    isReady?: boolean;
}

interface MatchPlayer {
    id: number;
    name?: string;
    data?: {
        ready: boolean;
    };
}

const lobbyClient = new LobbyClient({ 
  server: process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost:8000'
});

const retryWithDelay = async (fn: () => Promise<any>, retries = MAX_RETRIES): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryWithDelay(fn, retries - 1);
    }
    throw error;
  }
};

type ViewState = 'join' | 'waiting';

const Lobby: React.FC = () => {
    const navigate = useNavigate();
    const { gameState, setGameState } = useGame();
    const [view, setView] = useState<ViewState>('join');
    const [roomCode, setRoomCode] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [players, setPlayers] = useState<Player[]>([]);
    const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [connectionError, setConnectionError] = useState(false);

    // Add connection status check
    useEffect(() => {
        const checkServerConnection = async () => {
            try {
                await fetch('http://localhost:8000/health');
                setConnectionError(false);
            } catch (error) {
                console.error('Server connection error:', error);
                setConnectionError(true);
                setError('Unable to connect to game server. Please try again later.');
            }
        };

        checkServerConnection();
        const interval = setInterval(checkServerConnection, 5000);

        return () => clearInterval(interval);
    }, []);

    // Poll for match updates when in waiting room
    useEffect(() => {
        if (view === 'waiting' && gameState.roomCode) {
            const fetchMatchStatus = async () => {
                try {
                    const match = await lobbyClient.getMatch(GAME_NAME, gameState.roomCode!);
                    setConnectionError(false);
                    if (match && match.players) {
                        const activePlayers = match.players
                            .filter((p: MatchPlayer) => p.name)
                            .map((p: MatchPlayer) => ({
                                id: p.id.toString(),
                                name: p.name || `Player ${p.id + 1}`,
                                isReady: p.data?.ready || false,
                                gameStarted: p.data?.gameStarted || false
                            }));
                        setPlayers(activePlayers);
                        
                        // Update local ready state
                        const currentPlayer = match.players.find((p: MatchPlayer) => p.id.toString() === gameState.playerID);
                        setIsReady(currentPlayer?.data?.ready || false);

                        // Check if game has been started by host
                        if (activePlayers.length === 2 && 
                            activePlayers.every(p => p.isReady) && 
                            activePlayers.some(p => p.gameStarted)) {
                            setGameState(prev => ({
                                ...prev,
                                gameStarted: true,
                                isPlaying: true
                            }));
                            navigate('/game');
                        }
                    }
                } catch (error) {
                    console.error('Error fetching match status:', error);
                    setConnectionError(true);
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        setPollInterval(null);
                    }
                }
            };

            // Initial fetch with retry
            const initFetch = async () => {
                for (let i = 0; i < 3; i++) {
                    try {
                        await fetchMatchStatus();
                        break;
                    } catch (error) {
                        if (i === 2) {
                            setError('Failed to connect to game server. Please try again.');
                            handleLeaveRoom();
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            };

            initFetch();

            // Set up polling with error handling
            const interval = setInterval(fetchMatchStatus, 2000);
            setPollInterval(interval);

            return () => {
                if (interval) clearInterval(interval);
            };
        }
    }, [view, gameState.roomCode, gameState.playerID, navigate]);

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [pollInterval]);

    const handleCreateRoom = async () => {
        if (connectionError) {
            setError('Cannot create room: Server connection error');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Create a new match with retry logic
            const match = await retryWithDelay(() => 
                lobbyClient.createMatch(GAME_NAME, {
                    numPlayers: 2,
                })
            );

            // Join the match as the first player
            const { playerCredentials } = await retryWithDelay(() =>
                lobbyClient.joinMatch(
                    GAME_NAME,
                    match.matchID,
                    { 
                        playerID: '0',
                        playerName: `Player 1`
                    }
                )
            );

            // Update game state
            setGameState({
                roomCode: match.matchID,
                players: [{ id: '0' }],
                hostId: '0',
                gameStarted: false,
                currentTurn: undefined,
                isPlaying: false,
                playerID: '0',
                credentials: playerCredentials
            });

            setRoomCode(match.matchID);
            setView('waiting');

        } catch (error) {
            console.error('Failed to create room:', error);
            setError('Failed to connect to game server. Please try again.');
            setConnectionError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomCode) {
            setError('Please enter room code');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Join the match as the second player
            const { playerCredentials } = await lobbyClient.joinMatch(
                GAME_NAME,
                roomCode,
                {
                    playerID: '1',
                    playerName: `Player 2`
                }
            );

            // Update game state
            setGameState({
                roomCode,
                players: [{ id: '1' }],
                gameStarted: false,
                currentTurn: undefined,
                isPlaying: false,
                playerID: '1',
                credentials: playerCredentials
            });

            setView('waiting');

        } catch (error) {
            console.error('Failed to join room:', error);
            setError(error instanceof Error ? error.message : 'Failed to join room');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveRoom = async () => {
        if (!gameState.roomCode || !gameState.playerID || !gameState.credentials) {
            setView('join');
            return;
        }

        try {
            await lobbyClient.leaveMatch(
                GAME_NAME,
                gameState.roomCode,
                {
                    playerID: gameState.playerID,
                    credentials: gameState.credentials
                }
            );
        } catch (error) {
            console.error('Error leaving match:', error);
        }

        setGameState({
            roomCode: null,
            players: [],
            hostId: undefined,
            gameStarted: false,
            currentTurn: undefined,
            isPlaying: false,
            playerID: null,
            credentials: undefined
        });

        setView('join');
        setRoomCode('');
    };

    const handleStartGame = async () => {
        if (!gameState.roomCode || !gameState.playerID || !gameState.credentials) {
            setError('Invalid game state');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Start the game for all players
            await lobbyClient.updatePlayer(
                GAME_NAME,
                gameState.roomCode,
                {
                    playerID: gameState.playerID,
                    credentials: gameState.credentials,
                    data: { ready: true, gameStarted: true }
                }
            );

            // Update local game state and navigate
            setGameState(prev => ({
                ...prev,
                gameStarted: true,
                isPlaying: true
            }));
            
            navigate('/game');

        } catch (error) {
            console.error('Failed to start game:', error);
            setError(error instanceof Error ? error.message : 'Failed to start game');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleReady = async () => {
        if (!gameState.roomCode || !gameState.playerID || !gameState.credentials) {
            setError('Invalid game state');
            return;
        }

        try {
            setIsLoading(true);
            await lobbyClient.updatePlayer(
                GAME_NAME,
                gameState.roomCode,
                {
                    playerID: gameState.playerID,
                    credentials: gameState.credentials,
                    data: { ready: !isReady }
                }
            );
            setIsReady(!isReady);
        } catch (error) {
            console.error('Failed to update ready status:', error);
            setError('Failed to update ready status');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">No Kitty Card Game</h1>

            {connectionError && (
                <div className="lobby-error bg-red-600">
                    <span>Connection to game server lost. Attempting to reconnect...</span>
                </div>
            )}

            {error && (
                <div className="lobby-error">
                    <span>{error}</span>
                    <button 
                        className="lobby-button lobby-button-gray"
                        onClick={() => setError(null)}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center p-8">
                    <div className="text-2xl text-white animate-pulse">Loading...</div>
                </div>
            ) : view === 'join' ? (
                <div className="lobby-menu">
                    <button 
                        className="lobby-button lobby-button-blue w-full mb-4"
                        onClick={handleCreateRoom}
                        disabled={isLoading || connectionError}
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
                            disabled={isLoading || connectionError}
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
                        {[0, 1].map((playerNum) => {
                            const player = players.find(p => p.id === playerNum.toString());
                            const isCurrentPlayer = playerNum.toString() === gameState.playerID;
                            
                            return (
                                <div key={playerNum} className="lobby-player-item">
                                    {player ? (
                                        <>
                                            <span>Player {parseInt(player.id) + 1}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`lobby-player-status ${player.isReady ? 'lobby-player-ready' : 'lobby-player-waiting'}`}>
                                                    {player.isReady ? 'Ready' : 'Not Ready'}
                                                </span>
                                                {isCurrentPlayer && (
                                                    <button
                                                        className={`lobby-button ${isReady ? 'lobby-button-gray' : 'lobby-button-green'} py-1 px-3`}
                                                        onClick={handleToggleReady}
                                                        disabled={isLoading}
                                                    >
                                                        {isReady ? 'Cancel' : 'Ready'}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span>Waiting for Player {playerNum + 1}</span>
                                            <span className="lobby-player-status lobby-player-empty">Empty</span>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-4 mt-4">
                        {gameState.playerID === '0' && players.length === 2 && players.every(p => p.isReady) && (
                            <button 
                                className="lobby-button lobby-button-green flex-1"
                                onClick={handleStartGame}
                                disabled={isLoading}
                            >
                                Start Game
                            </button>
                        )}
                        <button 
                            className="lobby-button lobby-button-gray flex-1"
                            onClick={handleLeaveRoom}
                            disabled={isLoading}
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