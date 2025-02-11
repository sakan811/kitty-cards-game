import { Schema, MapSchema, ArraySchema, defineTypes } from "@colyseus/schema";

export class Player extends Schema {
    constructor() {
        super();
        this.id = "";
        this.ready = false;
        this.hasDrawnAssist = false;
        this.hasDrawnNumber = false;
        this.score = 0;
        this.hand = new ArraySchema();
    }
}
defineTypes(Player, {
    id: "string",
    ready: "boolean",
    hasDrawnAssist: "boolean",
    hasDrawnNumber: "boolean",
    score: "number",
    hand: ["string"]
});

export class Tile extends Schema {
    constructor() {
        super();
        this.index = 0;
        this.cupColor = 'white';
        this.hasNumber = false;
        this.number = null;
    }
}
defineTypes(Tile, {
    index: "number",
    cupColor: "string",
    hasNumber: "boolean",
    number: "number"
});

export class Card extends Schema {
    constructor() {
        super();
        this.type = "";
        this.color = "";
        this.value = 0;
        this.action = "";
    }
}
defineTypes(Card, {
    type: "string",
    color: "string",
    value: "number",
    action: "string"
});

export class GameState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.tiles = new ArraySchema();
        this.assistDeck = new ArraySchema();
        this.numberDeck = new ArraySchema();
        this.discardPile = new ArraySchema();
        this.currentPlayer = "";
        this.turnState = 'assist_phase';
        this.gameEnded = false;
        
        this.initializeDecks();
        this.initializeTiles();
    }

    initializeDecks() {
        // Initialize assist deck
        const assistTypes = ['double', 'swap', 'peek'];
        for (const type of assistTypes) {
            for (let i = 0; i < 2; i++) {
                const card = new Card();
                card.type = 'assist';
                card.action = type;
                this.assistDeck.push(card);
            }
        }
        this.shuffleDeck(this.assistDeck);

        // Initialize number deck
        const colors = ['brown', 'green', 'purple', 'red', 'white'];
        for (const color of colors) {
            for (let value = 1; value <= 10; value++) {
                const card = new Card();
                card.type = 'number';
                card.color = color;
                card.value = value;
                this.numberDeck.push(card);
            }
        }
        this.shuffleDeck(this.numberDeck);
    }

    initializeTiles() {
        const cupColors = ['brown', 'green', 'purple', 'red'];
        const positions = [0, 1, 2, 3, 4, 5, 6, 7];
        
        // Initialize all tiles with white cups
        for (let i = 0; i < 9; i++) {
            const tile = new Tile();
            tile.index = i;
            tile.cupColor = 'white';
            this.tiles.push(tile);
        }

        // Set middle tile (index 8)
        this.tiles[8].cupColor = null;

        // Shuffle positions and assign random colors to 4 tiles
        this.shuffleArray(positions);
        positions.slice(0, 4).forEach(pos => {
            const randomColor = cupColors[Math.floor(Math.random() * cupColors.length)];
            this.tiles[pos].cupColor = randomColor;
        });
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
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
            .filter((tile, index) => index !== 8) // Exclude middle tile
            .every(tile => tile.hasNumber);
            
        if (allTilesOccupied) {
            this.gameEnded = true;
        }
    }
}
defineTypes(GameState, {
    players: { map: Player },
    tiles: [Tile],
    assistDeck: [Card],
    numberDeck: [Card],
    discardPile: [Card],
    currentPlayer: "string",
    turnState: "string",
    gameEnded: "boolean"
}); 