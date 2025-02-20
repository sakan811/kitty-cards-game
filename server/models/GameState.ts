export interface Card {
    id: string;
    type: 'assist' | 'number';
    value?: number;
    color?: string;
}

export interface Player {
    id: string;
    ready: boolean;
    hasDrawnAssist: boolean;
    hasDrawnNumber: boolean;
    score: number;
    hand: Card[];
}

export interface Room {
    id: string;
    players: Map<string, Player>;
    state: GameState;
    currentTurn: string;
    isGameStarted: boolean;
}

export interface Tile {
    tileIndex: number;
    cupColor?: string;
    hasNumber: boolean;
    number?: number;
}

export class GameState {
    private assistDeck: Card[] = [];
    private numberDeck: Card[] = [];
    private tiles: Tile[] = [];

    constructor() {
        this.initializeDecks();
        this.initializeTiles();
    }

    private initializeDecks(): void {
        // Initialize assist cards
        const colors = ['brown', 'green', 'purple', 'red', 'white'];
        colors.forEach((color, index) => {
            this.assistDeck.push({
                id: `assist_${index}`,
                type: 'assist',
                color
            });
        });

        // Initialize number cards (1-10)
        for (let i = 1; i <= 10; i++) {
            this.numberDeck.push({
                id: `number_${i}`,
                type: 'number',
                value: i
            });
        }

        // Shuffle both decks
        this.shuffleDeck(this.assistDeck);
        this.shuffleDeck(this.numberDeck);
    }

    private initializeTiles(): void {
        // Create 9 tiles (3x3 grid)
        for (let i = 0; i < 9; i++) {
            this.tiles.push({
                tileIndex: i,
                hasNumber: false
            });
        }

        // Randomly assign colors to 4 cups
        const colors = ['brown', 'green', 'purple', 'red'];
        this.shuffleDeck(colors);
        
        // Assign colors to random tiles (excluding center tile)
        const availableTiles = [0, 1, 2, 3, 4, 5, 6, 7]; // Exclude center tile (8)
        this.shuffleDeck(availableTiles);
        
        for (let i = 0; i < 4; i++) {
            const tileIndex = availableTiles[i];
            this.tiles[tileIndex].cupColor = colors[i];
        }

        // Set remaining cups to white
        availableTiles.slice(4).forEach(tileIndex => {
            this.tiles[tileIndex].cupColor = 'white';
        });
    }

    private shuffleDeck<T>(deck: T[]): void {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    public drawCard(type: 'assist' | 'number'): Card | undefined {
        const deck = type === 'assist' ? this.assistDeck : this.numberDeck;
        return deck.pop();
    }

    public placeNumber(tileIndex: number, number: number): boolean {
        if (tileIndex < 0 || tileIndex >= this.tiles.length) return false;
        if (this.tiles[tileIndex].hasNumber) return false;

        this.tiles[tileIndex].hasNumber = true;
        this.tiles[tileIndex].number = number;
        return true;
    }

    public calculateScore(tileIndex: number, card: Card): number {
        const tile = this.tiles[tileIndex];
        if (!tile || !card.value) return 0;

        // Double points if colors match
        if (tile.cupColor === card.color) {
            return card.value * 2;
        }

        // White cups always give normal points
        if (tile.cupColor === 'white') {
            return card.value;
        }

        // No points if colors don't match
        return 0;
    }

    public getTiles(): Tile[] {
        return this.tiles;
    }

    public isGameOver(): boolean {
        return this.tiles.every(tile => tile.hasNumber);
    }
} 