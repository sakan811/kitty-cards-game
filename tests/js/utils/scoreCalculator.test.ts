import { describe, it, expect } from 'vitest';
import { calculateScore } from '../../../src/js/utils/scoreCalculator';
import { Card, Tile } from '../../../src/js/game/NoKittyCardsGame';

describe('scoreCalculator', () => {
  describe('calculateScore', () => {
    it('should return the card value for white cups', () => {
      const card: Card = { type: 'number', value: 5, color: 'red' };
      const tile: Tile = { position: 1, cupColor: 'white' };
      
      expect(calculateScore(card, tile)).toBe(5);
    });
    
    it('should return double the card value when colors match', () => {
      const card: Card = { type: 'number', value: 5, color: 'red' };
      const tile: Tile = { position: 1, cupColor: 'red' };
      
      expect(calculateScore(card, tile)).toBe(10);
    });
    
    it('should return 0 when colors do not match and cup is not white', () => {
      const card: Card = { type: 'number', value: 5, color: 'red' };
      const tile: Tile = { position: 1, cupColor: 'green' };
      
      expect(calculateScore(card, tile)).toBe(0);
    });
    
    it('should return 0 for assist cards', () => {
      const card: Card = { type: 'assist', value: 'assist' };
      const tile: Tile = { position: 1, cupColor: 'white' };
      
      expect(calculateScore(card, tile)).toBe(0);
    });
    
    it('should handle string number values', () => {
      const card: Card = { type: 'number', value: '7', color: 'purple' };
      const tile: Tile = { position: 1, cupColor: 'purple' };
      
      expect(calculateScore(card, tile)).toBe(14);
    });
  });
}); 