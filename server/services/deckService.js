import { ASSIST_CARDS } from '../config/constants.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export function generateNumberDeck() {
    return Array.from({ length: GAME_CONFIG.numberDeckSize }, () => ({
        type: 'number',
        value: Math.floor(Math.random() * GAME_CONFIG.maxNumberValue) + 1
    })).sort(() => Math.random() - 0.5);
}

export function generateAssistDeck() {
    return ASSIST_CARDS.map(card => ({ ...card }))
        .sort(() => Math.random() - 0.5);
}

export function generateTileLayout() {
    const cupColors = ['cup-purple', 'cup-red', 'cup-green', 'cup-brown'];
    const selectedColors = [...cupColors].sort(() => Math.random() - 0.5);
    
    // Create 8 tiles (3x3 grid minus center)
    const tiles = Array(8).fill(null).map((_, position) => ({
        position,
        hasCup: position < 4, // First 4 positions get colored cups
        cupColor: position < 4 ? selectedColors[position] : 'cup-white',
        hasNumber: false,
        number: null
    }));

    return {
        tiles,
        selectedColors
    };
}

export function calculateScore(tiles, playerId) {
    // This is a placeholder for score calculation logic
    // You'll need to implement the actual scoring rules here
    return 0;
} 