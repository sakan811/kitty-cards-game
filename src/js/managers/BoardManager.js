import { CARD_DIMENSIONS, HAND_CONFIG } from '../config/constants.js';
import { Deck } from '../entities/Deck.js';
import { Hand } from '../entities/Hand.js';
import { Tile } from '../entities/Tile.js';
import { DiscardPile } from '../entities/DiscardPile.js';

export class BoardManager {
    constructor(scene) {
        this.scene = scene;
        this.tiles = [];
        this.decks = {
            assist: null,
            number: null
        };
        this.playerHand = [];
    }

    createGameBoard() {
        // Validate game state
        if (!this.scene.gameState?.tiles?.tiles) {
            console.error('Invalid game state for board creation');
            return false;
        }

        // Create the 3x3 board layout
        this.createTiles();
        // Create decks in the middle tile
        this.createDecks();
        return true;
    }

    createTiles() {
        const tileSize = 120;
        const padding = 10;
        const boardWidth = tileSize * 3 + padding * 2;
        const boardHeight = tileSize * 3 + padding * 2;
        const startX = (this.scene.game.config.width - boardWidth) / 2;
        const startY = (this.scene.game.config.height - boardHeight) / 2;

        // Get tiles data from game state
        const tilesData = this.scene.gameState.tiles.tiles;
        
        // Create visual tiles
        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = startX + col * (tileSize + padding) + tileSize / 2;
            const y = startY + row * (tileSize + padding) + tileSize / 2;

            const tileData = tilesData[i];
            const tile = this.createTile(x, y, tileSize, tileData);
            this.tiles[i] = tile;
        }
    }

    createTile(x, y, size, tileData) {
        // Create tile background
        const tile = this.scene.add.rectangle(x, y, size, size, 0x333333);
        tile.setStrokeStyle(2, 0x666666);
        tile.setInteractive();
        tile.index = tileData.index;

        // Create cup sprite if not middle tile
        if (tileData.index !== 4 && tileData.cupColor) {
            const cupKey = `cup-${tileData.cupColor}`;
            const cup = this.scene.add.image(x, y, cupKey);
            cup.setScale(0.8);
            tile.cup = cup;
            tile.cupColor = tileData.cupColor;
        }

        // Add number if exists
        if (tileData.hasNumber && tileData.number !== null) {
            this.addNumberToTile(tile, tileData.number);
        }

        // Add click handler
        tile.on('pointerdown', () => {
            this.scene.onTileClick(tile, tileData.index);
        });

        return tile;
    }

    createDecks() {
        const middleTile = this.tiles[4]; // Middle tile
        const spacing = 40;

        // Create assist deck using assist card back image
        this.decks.assist = this.createDeck(
            middleTile.x - spacing,
            middleTile.y,
            'assist-card-back',
            () => this.handleDeckClick('assist')
        );

        // Create number deck using number card back image
        this.decks.number = this.createDeck(
            middleTile.x + spacing,
            middleTile.y,
            'number-card-back',
            () => this.handleDeckClick('number')
        );
    }

    createDeck(x, y, texture, onClick) {
        const deck = this.scene.add.image(x, y, texture);
        deck.setScale(0.5); // Adjust scale to fit the middle tile
        deck.setInteractive();
        deck.on('pointerdown', onClick);
        return deck;
    }

    handleDeckClick(deckType) {
        if (!this.scene.isPlayerTurn) return;

        if (deckType === 'assist' && this.scene.hasDrawnAssist) {
            this.scene.uiManager.showMessage('Already drawn an assist card');
            return;
        }

        if (deckType === 'number') {
            if (this.scene.hasDrawnNumber) {
                this.scene.uiManager.showMessage('Already drawn a number card');
                return;
            }
            if (!this.scene.hasDrawnAssist) {
                this.scene.uiManager.showMessage('Must draw assist card first');
                return;
            }
        }

        this.scene.socketManager.drawCard(deckType);
    }

    addCardToHand(card) {
        this.playerHand.push(card);
        this.updateHandDisplay();
    }

    updateHandDisplay() {
        // Clear existing hand display
        this.playerHand.forEach(card => card.sprite?.destroy());

        // Display new hand
        const cardWidth = 80;
        const padding = 10;
        const startX = (this.scene.game.config.width - (this.playerHand.length * (cardWidth + padding))) / 2;
        const y = this.scene.game.config.height - 100;

        this.playerHand.forEach((card, index) => {
            const x = startX + index * (cardWidth + padding) + cardWidth / 2;
            const sprite = this.createCardSprite(x, y, card);
            card.sprite = sprite;
        });
    }

    createCardSprite(x, y, card) {
        const sprite = this.scene.add.container(x, y);
        
        // Use card back image based on card type
        const bgTexture = card.type === 'assist' ? 'assist-card-back' : 'number-card-back';
        const bg = this.scene.add.image(0, 0, bgTexture);
        bg.setScale(0.5);
        
        // Add card value text overlay
        const text = this.scene.add.text(0, 0, card.value.toString(), {
            fontSize: '32px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        text.setOrigin(0.5);

        sprite.add([bg, text]);
        sprite.setSize(80, 120);
        sprite.setInteractive();
        sprite.on('pointerdown', () => this.scene.onCardSelect(card));

        return sprite;
    }

    getCupColor(colorName) {
        const colors = {
            'white': 0xffffff,
            'brown': 0x8b4513,
            'green': 0x228b22,
            'purple': 0x800080,
            'red': 0xff0000
        };
        return colors[colorName] || colors.white;
    }

    getCardColor(colorName) {
        const colors = {
            'white': '#000000',
            'brown': '#8b4513',
            'green': '#228b22',
            'purple': '#800080',
            'red': '#ff0000'
        };
        return colors[colorName] || colors.white;
    }

    addNumberToTile(tile, number) {
        const text = this.scene.add.text(tile.x, tile.y, number.toString(), {
            fontSize: '48px',
            fill: '#ffffff'
        });
        text.setOrigin(0.5);
        tile.number = text;
    }

    highlightValidTiles(card) {
        this.tiles.forEach(tile => {
            const tileData = this.scene.gameState.tiles.tiles[tile.index];
            if (!tileData.hasNumber && tileData.index !== 4) {
                tile.setStrokeStyle(2, 0x00ff00);
            }
        });
    }

    clearHighlights() {
        this.tiles.forEach(tile => {
            tile.setStrokeStyle(2, 0x666666);
        });
    }

    placeCardOnTile(tileIndex, card) {
        const tile = this.tiles[tileIndex];
        if (tile && !tile.number) {
            this.addNumberToTile(tile, card.value);
        }
    }

    updateBoard() {
        const tilesData = this.scene.gameState.tiles.tiles;
        tilesData.forEach((tileData, index) => {
            const tile = this.tiles[index];
            if (tile) {
                if (tileData.hasNumber && !tile.number) {
                    this.addNumberToTile(tile, tileData.number);
                }
            }
        });
    }

    updateInteractions() {
        const isPlayerTurn = this.scene.isPlayerTurn;
        
        // Update deck interactivity
        Object.values(this.decks).forEach(deck => {
            if (deck) {
                deck.setAlpha(isPlayerTurn ? 1 : 0.5);
                deck.input.enabled = isPlayerTurn;
            }
        });

        // Update tile interactivity
        this.tiles.forEach(tile => {
            tile.input.enabled = isPlayerTurn;
            tile.setAlpha(isPlayerTurn ? 1 : 0.7);
        });

        // Clear any existing highlights
        this.clearHighlights();
    }

    enableInteractions() {
        Object.values(this.decks).forEach(deck => {
            if (deck) deck.input.enabled = true;
        });
        this.tiles.forEach(tile => tile.input.enabled = true);
    }

    disableInteractions() {
        this.tiles.forEach(tile => {
            tile.disableInteractive();
        });
        Object.values(this.decks).forEach(deck => {
            if (deck) deck.disableInteractive();
        });
    }

    cleanup() {
        // Destroy all tiles and their associated elements
        this.tiles.forEach(tile => {
            if (tile.cup) {
                tile.cup.destroy();
            }
            if (tile.number) {
                tile.number.destroy();
            }
            tile.destroy();
        });
        this.tiles = [];

        // Destroy decks
        Object.values(this.decks).forEach(deck => {
            if (deck) deck.destroy();
        });
        this.decks = {
            assist: null,
            number: null
        };

        // Destroy hand cards
        this.playerHand.forEach(card => {
            if (card.sprite) {
                card.sprite.destroy();
            }
        });
        this.playerHand = [];
    }
} 