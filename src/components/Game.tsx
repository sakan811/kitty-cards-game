import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { useGame } from '../context/GameContext';
import { NoKittyCardsGame, NoKittyCardsState, Card, Tile } from '../js/game/NoKittyCardsGame';
import { BoardProps } from 'boardgame.io/react';
import '../styles/game.css';

interface GameBoardProps extends BoardProps<NoKittyCardsState> {}

const GameBoard: React.FC<GameBoardProps> = ({ G, ctx, moves }) => {
  const renderCard = (card?: Card) => {
    if (!card) return 'Empty';
    return `${card.type === 'number' ? `${card.value} ${card.color}` : 'Assist'}`;
  };

  const renderTile = (tile: Tile) => {
    return (
      <div 
        key={tile.position}
        className={`tile ${tile.cupColor}-cup ${tile.position === 4 ? 'middle-tile' : ''}`}
        onClick={() => {
          if (G.currentPhase === 'placeCard' && tile.position !== 4) {
            moves.placeCard(tile.position);
          }
        }}
      >
        <div className="cup-color">{tile.cupColor}</div>
        <div className="card-slot">
          {tile.card ? renderCard(tile.card) : 'Empty'}
        </div>
      </div>
    );
  };

  const playerHand = G.hands[ctx.currentPlayer] || {};

  return (
    <div className="game-board">
      <div className="game-info">
        <div>Current Phase: {G.currentPhase}</div>
        <div>Current Player: {ctx.currentPlayer}</div>
        <div>Score: {G.scores[ctx.currentPlayer] || 0}</div>
      </div>

      <div className="decks">
        <div className="deck assist-deck">
          <button 
            onClick={() => moves.drawAssistCard()}
            disabled={G.currentPhase !== 'drawAssist'}
          >
            Draw Assist Card
          </button>
          <div>Assist Cards: {G.assistDeck.length}</div>
        </div>

        <div className="deck number-deck">
          <button 
            onClick={() => moves.drawNumberCard()}
            disabled={G.currentPhase !== 'drawNumber'}
          >
            Draw Number Card
          </button>
          <div>Number Cards: {G.numberDeck.length}</div>
        </div>
      </div>

      <div className="player-hand">
        <h3>Your Hand</h3>
        <div className="cards">
          {playerHand.assist && (
            <div className="card assist-card">
              Assist Card: {renderCard(playerHand.assist)}
            </div>
          )}
          {playerHand.number && (
            <div className="card number-card">
              Number Card: {renderCard(playerHand.number)}
            </div>
          )}
        </div>
      </div>

      <div className="game-tiles">
        {G.tiles.map(renderTile)}
      </div>

      {G.winner && (
        <div className="winner-overlay">
          <h2>Game Over!</h2>
          <p>Winner: Player {G.winner}</p>
        </div>
      )}
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
      : 'http://localhost:8000',
    socketOpts: {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket'],
    }
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

  return (
    <div className="game-container">
      <KittyCardsClientComponent
        matchID={gameState.roomCode}
        playerID={gameState.playerID}
        credentials={gameState.credentials}
      />
    </div>
  );
};

export default Game; 