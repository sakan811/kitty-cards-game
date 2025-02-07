import { TURN_STATES } from '../config/constants.js';
import { generateNumberDeck, generateAssistDeck, generateTileLayout } from '../services/deckService.js';

export class GameState {
    constructor() {
        this.players = new Map();
        this.currentPlayer = null;
        this.turnState = 'assist_phase'; // assist_phase -> number_phase -> end_turn
        
        // Initialize decks
        this.decks = {
            assist: this.createAssistDeck(),
            number: this.createNumberDeck()
        };
        
        // Initialize game board
        this.tiles = this.initializeTiles();
        this.discardPile = [];
        this.gameEnded = false;
        this.scores = new Map();
    }

    initializeTiles() {
        const tiles = Array(9).fill(null).map((_, index) => ({
            index,
            cupColor: 'white', // Default color
            hasNumber: false,
            number: null
        }));

        // Remove middle tile (index 4)
        tiles[4] = { index: 4, cupColor: null, hasNumber: false, number: null };

        // Randomly assign 4 colored cups
        const colors = ['brown', 'green', 'purple', 'red'];
        const availableIndices = [0, 1, 2, 3, 5, 6, 7, 8];
        
        for (let i = 0; i < 4; i++) {
            const randomIndex = Math.floor(Math.random() * availableIndices.length);
            const tileIndex = availableIndices.splice(randomIndex, 1)[0];
            tiles[tileIndex].cupColor = colors[i];
        }

        return { tiles };
    }

    createAssistDeck() {
        // Create and shuffle assist deck
        const assistDeck = [];
        // Add assist cards logic here
        return this.shuffleDeck(assistDeck);
    }

    createNumberDeck() {
        const numberDeck = [];
        const colors = ['brown', 'green', 'purple', 'red', 'white'];
        
        // Create number cards with colors
        for (const color of colors) {
            for (let value = 1; value <= 10; value++) {
                numberDeck.push({ type: 'number', color, value });
            }
        }
        
        return this.shuffleDeck(numberDeck);
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    initializePlayer(playerId) {
        this.players.set(playerId, {
            id: playerId,
            hand: [],
            hasDrawnAssist: false,
            hasDrawnNumber: false
        });
        this.scores.set(playerId, 0);
    }

    setPlayerOrder(playerIds) {
        this.currentPlayer = playerIds[0];
    }

    addCardToHand(playerId, card) {
        const player = this.players.get(playerId);
        if (player) {
            player.hand.push(card);
        }
    }

    removeCardFromHand(playerId, cardIndex) {
        const player = this.players.get(playerId);
        if (player && cardIndex >= 0 && cardIndex < player.hand.length) {
            return player.hand.splice(cardIndex, 1)[0];
        }
        return null;
    }

    calculateScore(card, cupColor) {
        if (card.color === cupColor) {
            return card.value * 2; // Double points for matching colors
        }
        if (cupColor === 'white') {
            return card.value; // Normal points for white cups
        }
        return 0; // No points for non-matching colors
    }

    nextTurn() {
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentPlayer);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        
        // Reset current player's draw states
        const currentPlayer = this.players.get(this.currentPlayer);
        currentPlayer.hasDrawnAssist = false;
        currentPlayer.hasDrawnNumber = false;
        
        // Set next player
        this.currentPlayer = playerIds[nextIndex];
        this.turnState = 'assist_phase';
        
        // Check if game has ended
        this.checkGameEnd();
    }

    checkGameEnd() {
        const allTilesOccupied = this.tiles.tiles
            .filter((tile, index) => index !== 4) // Exclude middle tile
            .every(tile => tile.hasNumber);
            
        if (allTilesOccupied) {
            this.gameEnded = true;
        }
    }
} 