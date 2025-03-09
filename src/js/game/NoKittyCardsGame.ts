import { Game } from 'boardgame.io';
import type { Ctx } from 'boardgame.io';

const INVALID_MOVE = 'INVALID_MOVE';

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
      cards: Card[];
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
  
  setup: (context) => ({
    assistDeck: shuffleArray(createDeck('assist')),
    numberDeck: shuffleArray(createDeck('number')),
    tiles: setupTiles(),
    hands: {
      '0': { cards: [] },
      '1': { cards: [] }
    },
    scores: {
      '0': 0,
      '1': 0
    },
    winner: null,
    currentPhase: 'drawAssist'
  }),

  moves: {
    drawAssistCard: ({ G, ctx }: MoveContext) => {
      if (G.currentPhase !== 'drawAssist' || !G.assistDeck.length) return INVALID_MOVE;

      const card = G.assistDeck.pop();
      if (!card) return INVALID_MOVE;

      // Check if player already has 10 cards
      const currentHand = G.hands[ctx.currentPlayer].cards || [];
      if (currentHand.length >= 10) return INVALID_MOVE;

      G.hands[ctx.currentPlayer] = {
        ...G.hands[ctx.currentPlayer],
        cards: [...currentHand, card]
      };
      G.currentPhase = 'drawNumber';
    },

    drawNumberCard: ({ G, ctx }: MoveContext) => {
      if (G.currentPhase !== 'drawNumber' || !G.numberDeck.length) return INVALID_MOVE;

      const card = G.numberDeck.pop();
      if (!card) return INVALID_MOVE;

      // Check if player already has 10 cards
      const currentHand = G.hands[ctx.currentPlayer].cards || [];
      if (currentHand.length >= 10) return INVALID_MOVE;

      G.hands[ctx.currentPlayer] = {
        ...G.hands[ctx.currentPlayer],
        cards: [...currentHand, card]
      };
      G.currentPhase = 'placeCard';
    },

    placeCard: ({ G, ctx }: MoveContext, tilePosition: number, cardIndex: number) => {
      if (G.currentPhase !== 'placeCard') return INVALID_MOVE;
      
      const hand = G.hands[ctx.currentPlayer];
      if (!hand?.cards.length) return INVALID_MOVE;

      // Validate card index
      if (cardIndex < 0 || cardIndex >= hand.cards.length) return INVALID_MOVE;

      const tile = G.tiles[tilePosition];
      if (!tile || tile.card || tilePosition === MIDDLE_TILE) return INVALID_MOVE;

      // Place the card and calculate score
      const numberCard = hand.cards[cardIndex];
      
      // Only number cards can be placed on tiles
      if (numberCard.type !== 'number') return INVALID_MOVE;
      
      tile.card = numberCard;

      // Calculate score for this move
      let score = Number(numberCard.value);
      
      // Updated scoring logic:
      // 1. If card is placed on white cup, score is the card value
      // 2. If card color matches cup color, score is doubled
      // 3. If card color doesn't match cup color (and cup is not white), score is 0
      if (tile.cupColor === 'white') {
        // Score remains as is for white cups
        score = Number(numberCard.value);
      } else if (numberCard.color === tile.cupColor) {
        // Double points for matching colors
        score = Number(numberCard.value) * 2;
      } else {
        // Zero points for mismatched colors
        score = 0;
      }

      // Update player's score
      G.scores[ctx.currentPlayer] = (G.scores[ctx.currentPlayer] || 0) + score;

      // Remove the played card from the player's hand
      G.hands[ctx.currentPlayer] = {
        cards: hand.cards.filter((_, index) => index !== cardIndex)
      };

      // Reset phase for next turn
      G.currentPhase = 'drawAssist';
    }
  },

  turn: {
    minMoves: 1,
    maxMoves: 3,
    order: {
      first: () => 0,
      next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers
    }
  },

  endIf: ({ G, ctx }: { G: NoKittyCardsState; ctx: Ctx }) => {
    const isGameOver = G.tiles
      .filter((_tile: Tile, index: number) => index !== MIDDLE_TILE)
      .every((tile: Tile) => tile.card);

    if (isGameOver) {
      const scores = Object.entries(G.scores);
      if (!scores.length) return;

      const [winnerId] = scores.reduce<[string, number]>(
        (highest, current) => current[1] > highest[1] ? current : highest,
        ['0', 0]
      );

      return { winner: winnerId };
    }
  }
};

export default NoKittyCardsGame; 