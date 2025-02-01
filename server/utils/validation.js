import { TURN_STATES } from '../config/constants.js';

export function validateCardDraw(gameState, playerId, data) {
    const deck = gameState.decks[data.deckType];
    const playerState = gameState.players.get(playerId);
    
    // Basic validations
    if (gameState.currentPlayer !== playerId) {
        return { valid: false, error: 'Not your turn' };
    }

    if (!deck || deck.length === 0) {
        return { valid: false, error: 'Deck empty or not found' };
    }

    // Strict phase validation
    switch (gameState.turnState) {
        case TURN_STATES.ASSIST_PHASE:
            if (data.deckType !== 'assist' || playerState.hasDrawnAssist) {
                return { valid: false, error: 'Invalid assist phase draw' };
            }
            break;
            
        case TURN_STATES.NUMBER_PHASE:
            if (data.deckType !== 'number' || playerState.hasDrawnNumber) {
                return { valid: false, error: 'Invalid number phase draw' };
            }
            break;
            
        default:
            return { valid: false, error: 'Invalid turn state' };
    }

    return { valid: true };
}

export function validateCardPlay(gameState, playerId, data) {
    if (gameState.currentPlayer !== playerId) {
        return { valid: false, error: 'Not your turn' };
    }

    const hand = gameState.hands.get(playerId);
    if (!hand) {
        return { valid: false, error: 'Player hand not found' };
    }

    const tile = gameState.tiles.tiles[data.tileIndex];
    if (!tile) {
        return { valid: false, error: 'Invalid tile index' };
    }

    if (tile.hasNumber) {
        return { valid: false, error: 'Tile already has a number' };
    }

    const cardIndex = hand.findIndex(card => card.value === data.cardValue);
    if (cardIndex === -1) {
        return { valid: false, error: 'Card not found in hand' };
    }

    return { valid: true, cardIndex };
} 