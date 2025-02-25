import React, { useState } from 'react';
import { PlayerList } from './PlayerList';
import { ConnectionStatus } from './ConnectionStatus';

interface Player {
  id: string;
  name: string;
  isReady?: boolean;
}

interface WaitingRoomProps {
  players: Player[];
  roomCode: string;
  isHost: boolean;
  currentPlayerId?: string;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  isReady: boolean;
  error: string | null;
  connectionError: boolean;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  players,
  roomCode,
  isHost,
  currentPlayerId,
  onLeaveRoom,
  onToggleReady,
  onStartGame,
  isReady,
  error,
  connectionError,
}) => {
  const [copyText, setCopyText] = useState('Copy');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopyText('Copied!');
    setTimeout(() => {
      setCopyText('Copy');
    }, 2000);
  };

  return (
    <div className="lobby-container">
      <h1 className="lobby-title">Waiting Room</h1>

      <div className="lobby-room-info">
        <p className="text-gray-400">Room Code:</p>
        <div className="flex items-center justify-center gap-2">
          <span className="lobby-room-code">{roomCode}</span>
          <button
            className="lobby-copy-button"
            onClick={handleCopy}
          >
            {copyText}
          </button>
        </div>
      </div>

      <ConnectionStatus isError={connectionError} errorMessage={error || undefined} />

      <div className="lobby-players-list">
        <PlayerList
          players={players}
          currentPlayerId={currentPlayerId}
          isHost={isHost}
          onToggleReady={onToggleReady}
          onStartGame={onStartGame}
          isReady={isReady}
        />

        <button
          onClick={onLeaveRoom}
          className="lobby-button lobby-button-gray w-full mt-4"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}; 