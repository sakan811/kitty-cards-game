import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Card extends Schema {
    @type("string") type: string = "";
    @type("string") color: string = "";
    @type("number") value: number = 0;
    @type("string") action: string = "";
}

export class Player extends Schema {
    @type("string") id: string = "";
    @type("boolean") ready: boolean = false;
    @type("number") score: number = 0;
    @type("boolean") hasDrawnAssist: boolean = false;
    @type("boolean") hasDrawnNumber: boolean = false;
    @type([Card]) hand: ArraySchema<Card> = new ArraySchema<Card>();
}

export class Tile extends Schema {
    @type("number") index: number = 0;
    @type("string") cupColor: string = 'white';
    @type("boolean") hasNumber: boolean = false;
    @type("number") number: number | null = null;
}

export type AssistType = 'double' | 'swap' | 'peek';
export type CupColor = 'brown' | 'green' | 'purple' | 'red' | 'white' | null;
export type TurnState = 'waiting' | 'assist_phase' | 'number_phase';

export class GameState extends Schema {
    @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
    @type("string") currentPlayer: string = "";
    @type("string") turnState: TurnState = "waiting";
    @type("boolean") gameStarted: boolean = false;
    @type("boolean") gameEnded: boolean = false;
    @type(["string"]) turnOrder: ArraySchema<string> = new ArraySchema<string>();
    @type("number") currentTurn: number = 0;
    @type([Card]) assistDeck: ArraySchema<Card> = new ArraySchema<Card>();
    @type([Card]) numberDeck: ArraySchema<Card> = new ArraySchema<Card>();
    @type([Card]) discardPile: ArraySchema<Card> = new ArraySchema<Card>();
    @type([Tile]) tiles: ArraySchema<Tile> = new ArraySchema<Tile>();

    constructor() {
        super();
        this.initializeDecks();
        this.initializeTiles();
    }

    private initializeDecks(): void {
        // Initialize assist deck
        const assistTypes: AssistType[] = ['double', 'swap', 'peek'];
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
        const colors: CupColor[] = ['brown', 'green', 'purple', 'red', 'white'];
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

    private initializeTiles(): void {
        const cupColors: CupColor[] = ['brown', 'green', 'purple', 'red'];
        const positions: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
        
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
        positions.slice(0, 4).forEach((pos, idx) => {
            this.tiles[pos].cupColor = cupColors[idx % cupColors.length];
        });
    }

    private shuffleDeck<T>(deck: ArraySchema<T>): void {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    private shuffleArray<T>(array: T[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    public calculateScore(card: Card, cupColor: CupColor): number {
        if (card.color === cupColor) {
            return card.value * 2; // Double points for matching colors
        }
        if (cupColor === 'white') {
            return card.value; // Normal points for white cups
        }
        return 0; // No points for non-matching colors
    }

    public getNextPlayer(): string | null {
        if (!this.turnOrder.length) return null;
        this.currentTurn = (this.currentTurn + 1) % this.turnOrder.length;
        return this.turnOrder[this.currentTurn];
    }

    public setRandomTurnOrder(): string {
        // Convert players to array and shuffle
        const playerIds = Array.from(this.players.keys());
        for (let i = playerIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
        }
        
        // Clear and set new turn order
        this.turnOrder.length = 0;
        playerIds.forEach(id => this.turnOrder.push(id));
        
        // Set initial current player
        this.currentPlayer = this.turnOrder[0];
        this.currentTurn = 0;
        return this.currentPlayer;
    }
} 