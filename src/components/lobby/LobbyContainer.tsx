import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LobbyClient } from 'boardgame.io/client';
import { useGame } from '../../context/GameContext';
import { JoinView } from './JoinView';
import { WaitingRoom } from './WaitingRoom';

const GAME_NAME = 'no-kitty-cards-game';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  gameStarted?: boolean;
}

interface MatchPlayer {
  id: number;
  name?: string;
  data?: {
    ready: boolean;
    gameStarted?: boolean;
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

export const LobbyContainer: React.FC = () => {
  const navigate = useNavigate();
  const { gameState, setGameState } = useGame();
  const [view, setView] = useState<ViewState>('join');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // Server connection check
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

  // Match status polling
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
                gameStarted: p.data?.gameStarted
              }));
            setPlayers(activePlayers);

            const currentPlayer = match.players.find(
              (p: MatchPlayer) => p.id.toString() === gameState.playerID
            );
            setIsReady(currentPlayer?.data?.ready || false);

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
        }
      };

      fetchMatchStatus();
      const interval = setInterval(fetchMatchStatus, 2000);
      setPollInterval(interval);

      return () => clearInterval(interval);
    }
  }, [view, gameState.roomCode, gameState.playerID, navigate, setGameState]);

  const handleCreateRoom = async () => {
    if (connectionError) {
      setError('Cannot create room: Server connection error');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const match = await retryWithDelay(() =>
        lobbyClient.createMatch(GAME_NAME, {
          numPlayers: 2,
        })
      );

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

      setView('waiting');
    } catch (error) {
      console.error('Failed to create room:', error);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { playerCredentials } = await lobbyClient.joinMatch(
        GAME_NAME,
        roomCode,
        {
          playerID: '1',
          playerName: `Player 2`
        }
      );

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
      setError('Failed to join room. Please check the room code and try again.');
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
      console.error('Error leaving room:', error);
    }

    setGameState({
      roomCode: '',
      players: [],
      gameStarted: false,
      currentTurn: undefined,
      isPlaying: false,
      playerID: '',
      credentials: ''
    });
    setView('join');
  };

  const handleToggleReady = async () => {
    if (!gameState.roomCode || !gameState.playerID || !gameState.credentials) return;

    try {
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
      console.error('Error toggling ready state:', error);
      setError('Failed to update ready state. Please try again.');
    }
  };

  const handleStartGame = async () => {
    if (!gameState.roomCode || !gameState.playerID || !gameState.credentials) return;

    try {
      await lobbyClient.updatePlayer(
        GAME_NAME,
        gameState.roomCode,
        {
          playerID: gameState.playerID,
          credentials: gameState.credentials,
          data: { gameStarted: true }
        }
      );
      
      setGameState(prev => ({
        ...prev,
        gameStarted: true,
        isPlaying: true
      }));
      
      navigate('/game');
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game. Please try again.');
    }
  };

  if (view === 'waiting') {
    return (
      <WaitingRoom
        players={players}
        roomCode={gameState.roomCode ?? ''}
        isHost={gameState.playerID === '0'}
        currentPlayerId={gameState.playerID}
        onLeaveRoom={handleLeaveRoom}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartGame}
        isReady={isReady}
        error={error}
        connectionError={connectionError}
      />
    );
  }

  return (
    <JoinView
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      isLoading={isLoading}
      error={error}
      connectionError={connectionError}
    />
  );
}; 