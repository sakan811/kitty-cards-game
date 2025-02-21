import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LobbyClient } from 'boardgame.io/client';
import { useGame } from '../context/GameContext';

const GAME_NAME = 'no-kitty-cards-game';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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

type ViewState = 'join' | 'create' | 'waiting';

const Lobby: React.FC = () => {
    const navigate = useNavigate();
    const { gameState, setGameState } = useGame();
    const [view, setView] = useState<ViewState>('join');
    const [roomCode, setRoomCode] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateRoom = async () => {
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

            // Start the game
            await lobbyClient.updatePlayer(
                GAME_NAME,
                gameState.roomCode,
                {
                    playerID: gameState.playerID,
                    credentials: gameState.credentials,
                    data: { ready: true }
                }
            );

            // Navigate to game
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

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">No Kitty Card Game</h1>

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
                        onClick={() => setView('create')}
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
            ) : view === 'create' ? (
                <div className="lobby-menu">
                    <h2 className="text-xl mb-4">Create New Room</h2>
                    <div className="flex flex-col gap-4">
                        <button 
                            className="lobby-button lobby-button-blue"
                            onClick={handleCreateRoom}
                        >
                            Create Room
                        </button>
                        <button 
                            className="lobby-button lobby-button-gray"
                            onClick={() => setView('join')}
                        >
                            Back
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
                        <div className="lobby-player-item">
                            <span>Player {gameState.playerID}</span>
                            <span className="lobby-player-status lobby-player-ready">
                                Ready
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-4">
                        {gameState.playerID === '0' && (
                            <button 
                                className="lobby-button lobby-button-green flex-1"
                                onClick={handleStartGame}
                            >
                                Start Game
                            </button>
                        )}
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