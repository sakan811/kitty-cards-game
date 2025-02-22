import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { useGame } from '../context/GameContext';
import { NoKittyCardsGame, NoKittyCardsState, Card, Tile, GamePhase } from '../js/game/NoKittyCardsGame';
import { BoardProps } from 'boardgame.io/react';
import '../styles/game.css';

// Import assets
import assistCardBack from '../assets/images/cards/assist-card-back.jpg';
import numberCardBack from '../assets/images/cards/number-card-back.jpg';
import cupBrown from '../assets/images/cups/cup-brown.jpg';
import cupGreen from '../assets/images/cups/cup-green.jpg';
import cupPurple from '../assets/images/cups/cup-purple.jpg';
import cupRed from '../assets/images/cups/cup-red.jpg';
import cupWhite from '../assets/images/cups/cup-white.jpg';

interface GameBoardProps extends BoardProps<NoKittyCardsState> {
  playerID: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ G, ctx, moves, events, playerID }) => {
  const getCupImage = (color: string) => {
    switch (color) {
      case 'brown': return cupBrown;
      case 'green': return cupGreen;
      case 'purple': return cupPurple;
      case 'red': return cupRed;
      default: return cupWhite;
    }
  };

  const renderCard = (card?: Card) => {
    if (!card) return null;
    if (card.type === 'number') {
      return (
        <div className="card-content number-card">
          <span className="card-value">{card.value}</span>
          <div className={`card-color ${card.color}`} />
        </div>
      );
    }
    return <div className="card-content assist-card">Assist</div>;
  };

  const renderTile = (tile: Tile) => {
    const isMiddle = tile.position === 4;
    return (
      <div 
        key={tile.position}
        className={`tile ${isMiddle ? 'middle-tile' : ''}`}
        onClick={() => {
          if (G.currentPhase === 'placeCard' && !isMiddle) {
            moves.placeCard(tile.position);
          }
        }}
      >
        {!isMiddle && (
          <div className="cup-container">
            <img 
              src={getCupImage(tile.cupColor)} 
              alt={`${tile.cupColor} cup`} 
              className="cup-image"
            />
            {tile.card && (
              <div className="card-overlay">
                {renderCard(tile.card)}
              </div>
            )}
          </div>
        )}
        {isMiddle && (
          <div className="decks-container">
            <div className="deck-stack assist-deck">
              <img src={assistCardBack} alt="Assist deck" />
              <span>{G.assistDeck.length}</span>
            </div>
            <div className="deck-stack number-deck">
              <img src={numberCardBack} alt="Number deck" />
              <span>{G.numberDeck.length}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTurnIndicator = () => {
    const isYourTurn = ctx.currentPlayer === playerID;
    const hasPlacedCard = G.currentPhase === 'placeCard' && G.hands[ctx.currentPlayer]?.number === undefined;

    return (
      <div className={`turn-indicator ${isYourTurn ? 'your-turn' : ''}`}>
        {isYourTurn ? "Your Turn" : `Player ${ctx.currentPlayer}'s Turn`}
        <div className="turn-phase">
          {isYourTurn && (
            <div className="phase-steps">
              <div className={`step ${G.currentPhase === 'drawAssist' ? 'active' : 'completed'}`}>
                1. Draw Assist Card
              </div>
              <div className={`step ${G.currentPhase === 'drawNumber' ? 'active' : (G.currentPhase === 'placeCard' || hasPlacedCard) ? 'completed' : ''}`}>
                2. Draw Number Card
              </div>
              <div className={`step ${G.currentPhase === 'placeCard' && !hasPlacedCard ? 'active' : hasPlacedCard ? 'completed' : ''}`}>
                3. Place Card
              </div>
              {hasPlacedCard && (
                <button 
                  className="end-turn-button"
                  onClick={() => events?.endTurn?.()}
                >
                  End Turn
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPlayerHand = (playerId: string, isOpponent: boolean = false) => {
    const playerHand = G.hands[playerId] || {};
    const isCurrentPlayer = playerId === ctx.currentPlayer;
    
    return (
      <div className={`player-area ${isOpponent ? 'opponent' : 'current-player'}`}>
        <div className="player-info">
          <div className="player-name">Player {playerId}</div>
          <div className="player-score">Score: {G.scores[playerId] || 0}</div>
        </div>
        <div className="player-hand">
          <div className="cards">
            <div 
              className={`hand-slot assist ${isCurrentPlayer && G.currentPhase === 'drawAssist' ? 'active' : ''}`}
              onClick={() => isCurrentPlayer && G.currentPhase === 'drawAssist' && moves.drawAssistCard()}
            >
              {playerHand.assist && renderCard(playerHand.assist)}
            </div>
            <div 
              className={`hand-slot number ${isCurrentPlayer && G.currentPhase === 'drawNumber' ? 'active' : ''}`}
              onClick={() => isCurrentPlayer && G.currentPhase === 'drawNumber' && moves.drawNumberCard()}
            >
              {playerHand.number && renderCard(playerHand.number)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Get opponent's ID (if current player is 1, opponent is 2 and vice versa)
  const opponentId = ctx.currentPlayer === '1' ? '2' : '1';

  return (
    <div className="game-board">
      {renderTurnIndicator()}
      {renderPlayerHand(opponentId, true)}
      
      <div className="game-tiles">
        {G.tiles.map(renderTile)}
      </div>

      {renderPlayerHand(ctx.currentPlayer)}

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
  board: GameBoard as any, // Type assertion needed due to playerID handling
  debug: process.env.NODE_ENV === 'development',
  numPlayers: 2,
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