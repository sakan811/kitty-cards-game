import React, { useState } from 'react';
import { ConnectionStatus } from './ConnectionStatus';

interface JoinViewProps {
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  connectionError: boolean;
}

export const JoinView: React.FC<JoinViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  isLoading,
  error,
  connectionError,
}) => {
  const [roomCode, setRoomCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinRoom(roomCode);
  };

  return (
    <div className="lobby-container">
      <h1 className="lobby-title">No Kitty Cards</h1>

      <ConnectionStatus isError={connectionError} errorMessage={error || undefined} />

      <div className="lobby-menu">
        <button
          onClick={onCreateRoom}
          disabled={isLoading || connectionError}
          className={`lobby-button ${isLoading || connectionError ? 'lobby-button-gray' : 'lobby-button-blue'}`}
        >
          {isLoading ? 'Creating...' : 'Create New Room'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-500">OR</span>
          </div>
        </div>

        <form onSubmit={handleJoinSubmit}>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Enter Room Code"
            className="lobby-input"
            disabled={isLoading || connectionError}
          />
          <button
            type="submit"
            disabled={!roomCode || isLoading || connectionError}
            className={`lobby-button ${!roomCode || isLoading || connectionError ? 'lobby-button-gray' : 'lobby-button-green'} w-full mt-4`}
          >
            {isLoading ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}; 