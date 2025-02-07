import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../js/services/SocketService';
import { useGame } from '../context/GameContext';

const Lobby = () => {
  const [view, setView] = useState('menu'); // menu, create, join, waiting
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { setGameState } = useGame();

  useEffect(() => {
    let socket = null;
    try {
      setIsLoading(true);
      socket = socketService.connect();
      console.log('Socket connected:', socket?.connected);

      const handleConnect = () => {
        console.log('Socket connected successfully');
        setIsLoading(false);
      };

      const handleConnectError = (error) => {
        console.error('Socket connection error:', error);
        setError('Failed to connect to server. Please try again.');
        setIsLoading(false);
      };

      const handleRoomCreated = ({ roomId, playerId }) => {
        console.log('Room created:', roomId);
        setRoomCode(roomId);
        setPlayerId(playerId);
        setView('waiting');
        setGameState(prev => ({
          ...prev,
          roomCode: roomId,
          players: [{ id: playerId, ready: false }]
        }));
        // Ensure room is set in SocketService
        socketService.setRoom(roomId);
      };

      const handleJoinedRoom = ({ roomId, playerId, room }) => {
        console.log('Joined room:', roomId);
        if (!room || !room.players) {
          console.error('Invalid room data received:', room);
          setError('Invalid room data received');
          return;
        }
        
        setRoomCode(roomId);
        setPlayerId(playerId);
        setPlayers(room.players);
        setView('waiting');
        setGameState(prev => ({
          ...prev,
          roomCode: roomId,
          players: room.players,
          hostId: room.hostId
        }));
        // Ensure room is set in SocketService
        socketService.setRoom(roomId);
      };

      const handlePlayerJoined = ({ room }) => {
        console.log('Player joined:', room);
        setPlayers(room.players);
        setGameState(prev => ({
          ...prev,
          players: room.players
        }));
      };

      const handlePlayerReady = ({ room }) => {
        const currentRoom = socketService.getCurrentRoom();
        console.log('Player ready update:', room, 'Current room:', currentRoom);
        
        if (!currentRoom) {
          console.error('No room found in SocketService');
          setError('Room connection lost. Please rejoin.');
          setView('menu');
          return;
        }

        setPlayers(room.players);
        setGameState(prev => ({
          ...prev,
          players: room.players
        }));

        const allReady = room.players.every(player => player.ready);
        if (allReady && room.players.length === 2) {
          console.log('All players ready, starting game');
          socketService.emit('startGame');
        }
      };

      const handleGameStart = ({ roomId, gameState }) => {
        console.log('Game starting:', gameState);
        setGameState(prev => ({
          ...prev,
          isPlaying: true,
          currentTurn: gameState.currentTurn,
          ...gameState
        }));
        navigate('/game');
      };

      const handleRoomError = (error) => {
        console.error('Room error:', error);
        setError(error);
        // If room not found, reset the view
        if (error === 'Room not found') {
          setView('menu');
          setRoomCode('');
          setPlayers([]);
          setIsReady(false);
          socketService.disconnect(); // Disconnect and clean up
        }
        setTimeout(() => setError(''), 3000);
      };

      // Register event handlers
      socket.on('connect', handleConnect);
      socket.on('connect_error', handleConnectError);
      socket.on('roomCreated', handleRoomCreated);
      socket.on('joinedRoom', handleJoinedRoom);
      socket.on('playerJoined', handlePlayerJoined);
      socket.on('playerReady', handlePlayerReady);
      socket.on('gameStart', handleGameStart);
      socket.on('roomError', handleRoomError);

      // Cleanup function
      return () => {
        console.log('Cleaning up socket listeners');
        if (socket) {
          socket.off('connect', handleConnect);
          socket.off('connect_error', handleConnectError);
          socket.off('roomCreated', handleRoomCreated);
          socket.off('joinedRoom', handleJoinedRoom);
          socket.off('playerJoined', handlePlayerJoined);
          socket.off('playerReady', handlePlayerReady);
          socket.off('gameStart', handleGameStart);
          socket.off('roomError', handleRoomError);
        }
      };
    } catch (err) {
      console.error('Error in lobby setup:', err);
      setError('Failed to initialize lobby. Please refresh the page.');
      setIsLoading(false);
    }
  }, [navigate, setGameState]);

  const handleCreateRoom = () => {
    try {
      console.log('Creating room');
      socketService.emit('createRoom');
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    }
  };

  const handleJoinRoom = (roomId) => {
    if (!roomId) {
      console.error('No room ID provided');
      return;
    }
    console.log('Joining room:', roomId);
    socketService.emit('joinRoom', { roomId: roomId });
  };

  const handleReady = () => {
    try {
      const currentRoom = socketService.getCurrentRoom();
      if (!currentRoom) {
        setError('Room connection lost. Please rejoin.');
        setView('menu');
        return;
      }

      const newReadyState = !isReady;
      console.log('Setting ready state:', newReadyState, 'for room:', currentRoom);
      setIsReady(newReadyState);
      socketService.emit('playerReady', { ready: newReadyState });
    } catch (err) {
      console.error('Error setting ready state:', err);
      setError('Failed to update ready state. Please try again.');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
      .then(() => setError('Room code copied!'))
      .catch(() => setError('Failed to copy room code'));
  };

  if (isLoading) {
    return (
      <div className="lobby-container">
        <div className="text-2xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <h1 className="lobby-title">Kitty Cards Game</h1>
      
      {error && (
        <div className="lobby-error">
          {error}
        </div>
      )}

      {view === 'menu' && (
        <div className="lobby-menu">
          <button
            onClick={() => setView('create')}
            className="lobby-button lobby-button-blue"
          >
            Create Room
          </button>
          <button
            onClick={() => setView('join')}
            className="lobby-button lobby-button-green"
          >
            Join Room
          </button>
        </div>
      )}

      {view === 'create' && (
        <div className="lobby-menu">
          <button
            onClick={handleCreateRoom}
            className="lobby-button lobby-button-blue"
          >
            Create New Room
          </button>
          <button
            onClick={() => setView('menu')}
            className="lobby-button lobby-button-gray"
          >
            Back
          </button>
        </div>
      )}

      {view === 'join' && (
        <div className="lobby-menu">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Enter Room Code"
            className="lobby-input"
          />
          <button
            onClick={() => handleJoinRoom(roomCode)}
            className="lobby-button lobby-button-green"
          >
            Join Room
          </button>
          <button
            onClick={() => setView('menu')}
            className="lobby-button lobby-button-gray"
          >
            Back
          </button>
        </div>
      )}

      {view === 'waiting' && (
        <div className="lobby-menu">
          <div className="lobby-room-info">
            <h2 className="text-xl font-semibold mb-2">Room Code:</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="lobby-room-code">{roomCode}</span>
              <button
                onClick={copyRoomCode}
                className="lobby-copy-button"
              >
                📋
              </button>
            </div>
          </div>

          <div className="lobby-players-list">
            <h2 className="text-xl font-semibold mb-4">Players:</h2>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="lobby-player-item"
                >
                  <span>Player {player.id === playerId ? '(You)' : ''}</span>
                  <span className={`lobby-player-status ${
                    player.ready ? 'lobby-player-ready' : 'lobby-player-not-ready'
                  }`}>
                    {player.ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleReady}
            className={`lobby-button ${
              isReady
                ? 'lobby-button-gray'
                : 'lobby-button-green'
            }`}
          >
            {isReady ? 'Not Ready' : 'Ready'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Lobby; 