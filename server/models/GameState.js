import { TURN_STATES } from '../config/constants.js';
import { generateNumberDeck, generateAssistDeck, generateTileLayout } from '../services/deckService.js';

export class GameState {
    constructor() {
        this.tiles = generateTileLayout();
        this.players = new Map();
        this.currentPlayer = null;
        this.scores = {};
        this.hands = new Map();
        this.decks = {
            number: generateNumberDeck(),
            assist: generateAssistDeck()
        };
        this.discardPile = [];
        this.playerOrder = [];
        this.turnState = TURN_STATES.ASSIST_PHASE;
    }

    initializePlayer(playerId) {
        this.players.set(playerId, {
            id: playerId,
            ready: false,
            hasDrawnAssist: false,
            hasDrawnNumber: false
        });
        this.hands.set(playerId, []);
        this.scores[playerId] = 0;
    }

    setPlayerOrder(players) {
        this.playerOrder = players;
        this.currentPlayer = players[0];
    }

    nextTurn() {
        const currentIndex = this.playerOrder.indexOf(this.currentPlayer);
        this.currentPlayer = this.playerOrder[(currentIndex + 1) % this.playerOrder.length];
        this.turnState = TURN_STATES.ASSIST_PHASE;
        
        // Reset draw states for all players
        this.players.forEach(player => {
            player.hasDrawnAssist = false;
            player.hasDrawnNumber = false;
        });
    }

    getPlayerHand(playerId) {
        return this.hands.get(playerId) || [];
    }

    addCardToHand(playerId, card) {
        const hand = this.hands.get(playerId);
        if (hand) {
            hand.push(card);
        }
    }

    removeCardFromHand(playerId, cardIndex) {
        const hand = this.hands.get(playerId);
        if (hand && cardIndex >= 0 && cardIndex < hand.length) {
            return hand.splice(cardIndex, 1)[0];
        }
        return null;
    }
} 