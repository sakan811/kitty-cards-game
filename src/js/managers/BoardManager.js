import { CARD_DIMENSIONS, HAND_CONFIG } from '../config/constants.js';
import { Deck } from '../entities/Deck.js';
import { Hand } from '../entities/Hand.js';
import { Tile } from '../entities/Tile.js';
import { DiscardPile } from '../entities/DiscardPile.js';

export class BoardManager {
    constructor(scene) {
        this.scene = scene;
    }

    createGameBoard() {
        const { positions, dimensions } = this.calculateBoardLayout();
        this.createTiles(positions);
        this.createDecks(dimensions);
    }

    calculateBoardLayout() {
        const gameWidth = this.scene.scale.width;
        const gameHeight = this.scene.scale.height;
        
        const tileSize = Math.min(gameWidth, gameHeight) * 0.12;
        const tileSpacing = tileSize * 0.15;
        const gridWidth = (tileSize * 3) + (tileSpacing * 2);
        const gridHeight = (tileSize * 3) + (tileSpacing * 2);
        
        const centerX = gameWidth / 2;
        const centerY = (gameHeight / 2) - (gameHeight * 0.2);
        const gridStartX = centerX - (gridWidth / 2);
        const gridStartY = centerY - (gridHeight / 2);

        const positions = this.calculateTilePositions(gridStartX, gridStartY, tileSize, tileSpacing);

        return { 
            positions, 
            dimensions: { 
                gridWidth, 
                gridHeight, 
                centerX, 
                centerY, 
                gridStartY 
            } 
        };
    }

    calculateTilePositions(startX, startY, tileSize, spacing) {
        return [
            // Top row
            { x: startX, y: startY },
            { x: startX + tileSize + spacing, y: startY },
            { x: startX + (tileSize * 2) + (spacing * 2), y: startY },
            
            // Middle row (sides only)
            { x: startX, y: startY + spacing + tileSize },
            { x: startX + (tileSize * 2) + (spacing * 2), y: startY + spacing + tileSize },
            
            // Bottom row
            { x: startX, y: startY + (tileSize * 2) + (spacing * 2) },
            { x: startX + tileSize + spacing, y: startY + (tileSize * 2) + (spacing * 2) },
            { x: startX + (tileSize * 2) + (spacing * 2), y: startY + (tileSize * 2) + (spacing * 2) }
        ];
    }

    createTiles(positions) {
        const tilesData = this.scene.gameState.tiles || Array(8).fill().map(() => ({
            cupColor: 'cup-white',
            hasCup: true,
            value: null
        }));

        this.scene.tiles = tilesData.map((tileData, index) => {
            const pos = positions[index];
            const validTileData = this.validateTileData(tileData);
            
            return new Tile(
                this.scene,
                pos.x + (CARD_DIMENSIONS.width/2),
                pos.y + (CARD_DIMENSIONS.height/2),
                index,
                validTileData.cupColor
            );
        });
    }

    validateTileData(tileData) {
        return {
            cupColor: tileData?.cupColor || 'cup-white',
            hasCup: tileData?.hasCup ?? true,
            value: tileData?.value || null
        };
    }

    createPlayerArea() {
        this.createPlayerHand();
        this.createDiscardPile();
    }

    createPlayerHand() {
        const handY = this.scene.scale.height - HAND_CONFIG.height - 10;
        this.scene.hand = new Hand(this.scene, 10, handY, this.scene.scale.width - 20);
    }

    createDiscardPile() {
        const discardX = this.scene.hand.x + this.scene.hand.width + CARD_DIMENSIONS.width/2 + 20;
        this.scene.discardPile = new DiscardPile(
            this.scene,
            discardX,
            this.scene.hand.y + CARD_DIMENSIONS.height/2
        );
    }

    createDecks({ centerX, gridWidth, gridStartY }) {
        const deckY = gridStartY + (gridWidth / 2);
        
        this.scene.decks = {
            number: new Deck(this.scene, centerX - (gridWidth * 0.8), deckY, 'number'),
            assist: new Deck(this.scene, centerX + (gridWidth * 0.8), deckY, 'assist')
        };

        Object.values(this.scene.decks).forEach(deck => {
            deck.visual.setInteractive({ useHandCursor: true });
            deck.visual.on('pointerdown', () => this.scene.onDeckClick(deck));
        });
    }

    updateDeckInteractions() {
        if (!this.scene.decks) return;

        Object.entries(this.scene.decks).forEach(([type, deck]) => {
            const canInteract = this.scene.isPlayerTurn && this.scene.currentPhase === 'draw';
            deck.setInteractive(canInteract);
            deck.visual.setTint(canInteract ? 0xffffff : 0x666666);
        });
    }

    enableInteractions() {
        if (this.scene.decks) {
            this.updateDeckInteractions();
        }
    }

    disableInteractions() {
        if (this.scene.hand?.cards) {
            this.scene.hand.cards.forEach(card => {
                if (card.frontSprite) card.frontSprite.disableInteractive();
                if (card.backSprite) card.backSprite.disableInteractive();
            });
        }

        if (this.scene.decks) {
            Object.values(this.scene.decks).forEach(deck => {
                deck.visual?.removeInteractive();
            });
        }

        if (this.scene.tiles) {
            this.scene.tiles.forEach(tile => {
                tile.sprite?.removeInteractive();
            });
        }
    }
} 