import { Game, Ctx } from 'boardgame.io';

export type CupColor = 'brown' | 'green' | 'purple' | 'red' | 'white';
export type CardType = 'assist' | 'number';

export interface Card {
  type: CardType;
  value: string | number;
  color?: CupColor;
}

export interface Tile {
  position: number;
  cupColor: CupColor;
  card?: Card;
}

export interface NoKittyCardsState {
  assistDeck: Card[];
  numberDeck: Card[];
  tiles: Tile[];
  hands: {
    [key: string]: {
      assist?: Card;
      number?: Card;
    };
  };
  scores: {
    [key: string]: number;
  };
  winner: string | null;
  currentPhase: 'drawAssist' | 'drawNumber' | 'placeCard';
}

const TOTAL_TILES = 9;
const MIDDLE_TILE = 4;
const COLORED_CUPS = 4;

const createDeck = (type: CardType): Card[] => {
  if (type === 'assist') {
    // Create assist cards deck
    return Array(20).fill(null).map(() => ({
      type: 'assist',
      value: 'assist'
    }));
  } else {
    // Create number cards deck with colors
    const colors: CupColor[] = ['brown', 'green', 'purple', 'red', 'white'];
    const numbers = Array(10).fill(0).map((_, i) => i + 1);
    const deck: Card[] = [];
    
    colors.forEach(color => {
      numbers.forEach(num => {
        deck.push({
          type: 'number',
          value: num,
          color
        });
      });
    });
    
    return deck;
  }
};

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const setupTiles = (): Tile[] => {
  // Create all white tiles first
  const tiles: Tile[] = Array(TOTAL_TILES).fill(null).map((_, index) => ({
    position: index,
    cupColor: 'white'
  }));

  // Remove middle tile
  tiles[MIDDLE_TILE] = {
    position: MIDDLE_TILE,
    cupColor: 'white',
    card: undefined
  };

  // Randomly assign colored cups
  const colors: CupColor[] = ['brown', 'green', 'purple', 'red'];
  const shuffledColors = shuffleArray(colors);
  const availablePositions = tiles
    .map((_, index) => index)
    .filter(index => index !== MIDDLE_TILE);
  
  shuffleArray(availablePositions)
    .slice(0, COLORED_CUPS)
    .forEach((position, index) => {
      tiles[position].cupColor = shuffledColors[index];
    });

  return tiles;
};

// Add interface for move context
interface MoveContext {
  G: NoKittyCardsState;
  ctx: Ctx;
  events: {
    endTurn: () => void;
  };
}

export const NoKittyCardsGame: Game<NoKittyCardsState> = {
  name: 'no-kitty-cards-game',
  
  setup: ({ ctx }) => ({
    assistDeck: shuffleArray(createDeck('assist')),
    numberDeck: shuffleArray(createDeck('number')),
    tiles: setupTiles(),
    hands: {
      '1': {},
      '2': {}
    },
    scores: {
      '1': 0,
      '2': 0
    },
    winner: null,
    currentPhase: 'drawAssist'
  }),

  moves: {
    drawAssistCard: ({ G, ctx }: MoveContext) => {
      if (G.currentPhase !== 'drawAssist' || !G.assistDeck.length) return;

      const card = G.assistDeck.pop();
      if (!card) return;

      G.hands[ctx.currentPlayer] = {
        ...G.hands[ctx.currentPlayer] || {},
        assist: card
      };
      G.currentPhase = 'drawNumber';
    },

    drawNumberCard: ({ G, ctx }: MoveContext) => {
      if (G.currentPhase !== 'drawNumber' || !G.numberDeck.length) return;

      const card = G.numberDeck.pop();
      if (!card) return;

      G.hands[ctx.currentPlayer] = {
        ...G.hands[ctx.currentPlayer] || {},
        number: card
      };
      G.currentPhase = 'placeCard';
    },

    placeCard: ({ G, ctx }: MoveContext, tilePosition: number) => {
      if (G.currentPhase !== 'placeCard') return;
      
      const hand = G.hands[ctx.currentPlayer];
      if (!hand?.number) return;

      const tile = G.tiles[tilePosition];
      if (!tile || tile.card || tilePosition === MIDDLE_TILE) return;

      // Place the card and calculate score
      const numberCard = hand.number;
      tile.card = numberCard;

      // Calculate score for this move
      let score = Number(numberCard.value);
      if (numberCard.color === tile.cupColor) {
        score *= 2; // Double points for matching colors
      } else if (tile.cupColor !== 'white' && numberCard.color !== tile.cupColor) {
        score = 0; // Zero points for mismatched colors (except white cups)
      }

      // Update player's score
      G.scores[ctx.currentPlayer] = (G.scores[ctx.currentPlayer] || 0) + score;

      // Clear the player's hand
      G.hands[ctx.currentPlayer] = {};

      // Reset phase for next turn
      G.currentPhase = 'drawAssist';
    }
  },

  turn: {
    minMoves: 1,
    maxMoves: 3, // Allow up to 3 moves per turn (draw assist, draw number, place card)
    order: {
      first: () => '1',
      next: () => '2'
    }
  },

  endIf: ({ G, ctx }: { G: NoKittyCardsState; ctx: Ctx }) => {
    const isGameOver = G.tiles
      .filter((_tile: Tile, index: number) => index !== MIDDLE_TILE)
      .every((tile: Tile) => tile.card);

    if (isGameOver) {
      const scores = Object.entries(G.scores);
      if (!scores.length) return;

      const [winnerId, _highestScore] = scores.reduce<[string, number]>((highest, current) => 
        current[1] > highest[1] ? current : highest
      );

      return { winner: winnerId };
    }
  }
};

export default NoKittyCardsGame; 