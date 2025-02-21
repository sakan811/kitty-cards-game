import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { useGame } from '../context/GameContext';
import { NoKittyCardsGame, NoKittyCardsState } from '../js/game/NoKittyCardsGame';
import { BoardProps } from 'boardgame.io/react';

interface GameBoardProps extends BoardProps<NoKittyCardsState> {}

const GameBoard: React.FC<GameBoardProps> = ({ G, ctx, moves }) => {
  return (
    <div className="game-board">
      <div className="deck">
        <button onClick={() => moves.drawCard()}>Draw Card</button>
        <div>Cards in deck: {G.deck.length}</div>
      </div>

      <div className="player-hand">
        <h3>Your Hand</h3>
        <div className="cards">
          {G.hands[ctx.currentPlayer]?.map((card: string, index: number) => (
            <button
              key={index}
              onClick={() => moves.playCard(index)}
              className="card"
            >
              {card}
            </button>
          ))}
        </div>
      </div>

      <div className="discard-pile">
        <h3>Discard Pile</h3>
        <div>Top card: {G.discardPile[G.discardPile.length - 1] || 'None'}</div>
      </div>
    </div>
  );
};

// Create the client as a React component
const KittyCardsClientComponent = Client<NoKittyCardsState>({
  game: NoKittyCardsGame,
  board: GameBoard,
  debug: process.env.NODE_ENV === 'development',
  multiplayer: SocketIO({ 
    server: process.env.NODE_ENV === 'production' 
      ? window.location.origin
      : 'http://localhost:8000'
  }),
});

const Game: React.FC = () => {
  const navigate = useNavigate();
  const { gameState } = useGame();

  if (!gameState.isPlaying || !gameState.roomCode || !gameState.playerID) {
    console.log('Redirecting to lobby: Not in game state');
    navigate('/lobby');
    return null;
  }

  // Use type assertion to handle the Client component
  const GameClient = KittyCardsClientComponent as React.ComponentType<{
    matchID: string;
    playerID: string;
    debug?: boolean;
  }>;

  return (
    <div className="game-container">
      <GameClient
        matchID={gameState.roomCode}
        playerID={gameState.playerID}
        debug={process.env.NODE_ENV === 'development'}
      />
    </div>
  );
};

export default Game; 