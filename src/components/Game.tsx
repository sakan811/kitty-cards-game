import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { useGame } from '../context/GameContext';
import { NoKittyCardsGame, NoKittyCardsState, Card, Tile } from '../js/game/NoKittyCardsGame';
import { BoardProps } from 'boardgame.io/react';
import '../styles/main.css';

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
  const [selectedCardIndex, setSelectedCardIndex] = React.useState<number | null>(null);

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
          if (G.currentPhase === 'placeCard' && !isMiddle && selectedCardIndex !== null) {
            moves.placeCard(tile.position, selectedCardIndex);
            setSelectedCardIndex(null);
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
            <div 
              className={`deck-stack assist-deck ${G.currentPhase === 'drawAssist' && ctx.currentPlayer === playerID ? 'active' : ''}`}
              onClick={() => {
                if (G.currentPhase === 'drawAssist' && ctx.currentPlayer === playerID) {
                  moves.drawAssistCard();
                }
              }}
            >
              <img src={assistCardBack} alt="Assist deck" />
              <span>{G.assistDeck.length}</span>
            </div>
            <div 
              className={`deck-stack number-deck ${G.currentPhase === 'drawNumber' && ctx.currentPlayer === playerID ? 'active' : ''}`}
              onClick={() => {
                if (G.currentPhase === 'drawNumber' && ctx.currentPlayer === playerID) {
                  moves.drawNumberCard();
                }
              }}
            >
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
    const hasPlacedCard = G.currentPhase === 'placeCard' && G.hands[ctx.currentPlayer]?.cards.length === 0;

    return (
      <div className={`turn-indicator ${isYourTurn ? 'your-turn' : ''}`}>
        {isYourTurn ? "Your Turn" : `Player ${parseInt(ctx.currentPlayer) + 1}'s Turn`}
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
    const playerHand = G.hands[playerId] || { cards: [] };
    const isCurrentPlayer = playerId === ctx.currentPlayer;
    const isYourHand = playerId === playerID;
    
    return (
      <div className={`player-area ${isOpponent ? 'opponent' : 'current-player'}`}>
        <div className="player-info">
          <div className="player-name">
            {isYourHand ? 'You' : 'Opponent'} (Player {parseInt(playerId) + 1})
          </div>
          <div className="player-score">Score: {G.scores[playerId] || 0}</div>
        </div>
        <div className="player-hand">
          <div className="cards-container">
            <div className="cards-fan">
              {playerHand.cards.map((card, index) => {
                const rotationAngle = playerHand.cards.length > 1 
                  ? -15 + (30 / (playerHand.cards.length - 1)) * index 
                  : 0;
                const translateX = playerHand.cards.length > 1
                  ? -50 + (100 / (playerHand.cards.length - 1)) * index
                  : 0;
                
                return (
                  <div 
                    key={index}
                    className={`card-in-hand ${card.type}`}
                    style={{
                      transform: `rotate(${rotationAngle}deg) translateX(${translateX}px)`,
                      zIndex: index + 1
                    }}
                    onClick={() => {
                      if (isYourHand && isCurrentPlayer && G.currentPhase === 'placeCard' && card.type === 'number') {
                        // Set this card as the selected card for placement
                        setSelectedCardIndex(index);
                      }
                    }}
                  >
                    {isYourHand ? (
                      renderCard(card)
                    ) : (
                      <div className={`card-back ${card.type}-back`}>
                        <img 
                          src={card.type === 'assist' ? assistCardBack : numberCardBack} 
                          alt={`${card.type} card back`} 
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Get opponent's ID based on playOrder
  const opponentId = ctx.playOrder.find(id => id !== playerID) || '1';

  return (
    <div className="game-board">
      {renderTurnIndicator()}
      {renderPlayerHand(opponentId, true)}
      
      <div className="game-tiles">
        {G.tiles.map(renderTile)}
      </div>

      {renderPlayerHand(playerID)}

      {G.winner && (
        <div className="winner-overlay">
          <h2>Game Over!</h2>
          <p>
            {G.winner === playerID ? 'You Won!' : 'Opponent Won!'}
            (Player {parseInt(G.winner) + 1})
          </p>
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
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      upgrade: true,
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