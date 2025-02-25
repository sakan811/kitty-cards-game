import React from 'react';

interface Player {
  id: string;
  name: string;
  isReady?: boolean;
}

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  isHost: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
  isReady: boolean;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  currentPlayerId,
  isHost,
  onToggleReady,
  onStartGame,
  isReady
}) => {
  const allPlayersReady = players.length === 2 && players.every(p => p.isReady);

  return (
    <div>
      {[0, 1].map((playerNum) => {
        const player = players.find(p => p.id === playerNum.toString());
        const isCurrentPlayer = playerNum.toString() === currentPlayerId;
        
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
                      onClick={onToggleReady}
                      className={`lobby-button ${isReady ? 'lobby-button-gray' : 'lobby-button-green'} py-1 px-3`}
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

      {isHost && (
        <button
          onClick={onStartGame}
          disabled={!allPlayersReady}
          className={`lobby-button ${allPlayersReady ? 'lobby-button-blue' : 'lobby-button-gray'} w-full mt-4`}
        >
          Start Game
        </button>
      )}
    </div>
  );
}; 