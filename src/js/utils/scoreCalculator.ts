import { Card, Tile } from '../game/NoKittyCardsGame';

/**
 * Calculates the score for a card placed on a tile
 * 
 * Scoring rules:
 * 1. If card is placed on white cup, score is the card value
 * 2. If card color matches cup color, score is doubled
 * 3. If card color doesn't match cup color (and cup is not white), score is 0
 * 
 * @param card The card being placed
 * @param tile The tile where the card is being placed
 * @returns The calculated score
 */
export const calculateScore = (card: Card, tile: Tile): number => {
  if (card.type !== 'number') {
    return 0; // Assist cards don't provide score
  }

  const cardValue = Number(card.value);
  
  if (tile.cupColor === 'white') {
    // Score remains as is for white cups
    return cardValue;
  } else if (card.color === tile.cupColor) {
    // Double points for matching colors
    return cardValue * 2;
  } else {
    // Zero points for mismatched colors
    return 0;
  }
}; 