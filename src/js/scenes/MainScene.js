import { COLORS, ASSET_KEYS, CARD_DIMENSIONS, ASSIST_CARDS, HAND_CONFIG } from '../config/constants.js';
import { Deck } from '../entities/Deck.js';
import { Hand } from '../entities/Hand.js';
import { Tile } from '../entities/Tile.js';
import { DiscardPile } from '../entities/DiscardPile.js';
import { Card } from '../entities/Card.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.socket = null;
        this.selectedCard = null;
        this.totalPoints = 0;
        this.pointsText = null;
        this.isPlayerTurn = false;
        this.playerId = null;
        this.opponentId = null;
        this.roomId = null;
        this.turnText = null;
        this.gameState = null;
        this.hand = {
            cards: [],
            addCard: (card) => {
                this.hand.cards.push(card);
                return true;
            },
            removeCard: (card) => {
                const index = this.hand.cards.indexOf(card);
                if (index > -1) {
                    this.hand.cards.splice(index, 1);
                    return true;
                }
                return false;
            }
        };
        this.opponentHand = {
            container: null,
            numberStack: {
                cards: [],
                container: null,
                count: 0
            },
            assistStack: {
                cards: [],
                container: null,
                count: 0
            }
        };
    }

    init(data) {
        console.log('MainScene init with data:', data);
        if (data && data.socket) {
            this.socket = data.socket;
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            
            // Set opponent ID from the players list
            if (data.players) {
                this.opponentId = data.players.find(p => p.id !== this.playerId)?.id;
            }

            // Set initial game state
            if (data.gameState) {
                this.gameState = data.gameState;
                this.isPlayerTurn = data.gameState.currentPlayer === this.playerId;
            }
            
            this.setupSocketListeners();
            console.log('Game initialized with:', { 
                roomId: this.roomId, 
                playerId: this.playerId, 
                opponentId: this.opponentId,
                gameState: this.gameState
            });
        } else {
            console.error('No socket provided to MainScene');
        }
    }

    setupSocketListeners() {
        if (!this.socket) {
            console.error('Cannot setup listeners: Socket not initialized');
            return;
        }

        // Add specific handler for opponent actions
        this.socket.on('opponentAction', ({ action, data }) => {
            console.log('Received opponent action:', action, data);
            this.handleOpponentAction(action, data);
        });

        this.socket.on('gameUpdate', ({ roomId, playerId, action, data, gameState }) => {
            if (roomId !== this.roomId) return;
            console.log('Game update:', { playerId, action, data, gameState });
            
            // Update game state
            this.gameState = gameState;

            // Only handle actions from opponent
            if (playerId !== this.playerId) {
                this.handleOpponentAction(action, data);
            }
        });

        this.socket.on('turnUpdate', ({ roomId, currentPlayer }) => {
            if (roomId === this.roomId) {
                this.isPlayerTurn = currentPlayer === this.playerId;
                this.updateTurnIndicator();
                if (this.isPlayerTurn) {
                    this.enableAllInteractions();
                } else {
                    this.disableAllInteractions();
                }
            }
        });

        this.socket.on('playerLeft', ({ roomId }) => {
            if (roomId === this.roomId) {
                this.showGameOver('Opponent left the game');
            }
        });

        // Add specific handler for opponent hand updates
        this.socket.on('opponentHandUpdate', ({ roomId, handCount }) => {
            if (roomId === this.roomId) {
                console.log('Received opponent hand update:', handCount);
                this.updateOpponentHand(handCount);
            }
        });
    }

    handleOpponentAction(action, data) {
        console.log('Handling opponent action:', action, data);
        switch (action) {
            case 'drawCard':
                if (data.deckType) {
                    console.log(`Opponent drew a ${data.deckType} card`);
                    this.updateOpponentStack(data.deckType, 1, true);
                }
                break;
            case 'playCard':
                if (data.tileIndex !== undefined) {
                    this.updateOpponentStack('number', -1, false);
                    const tile = this.tiles[data.tileIndex];
                    if (tile) {
                        tile.setNumber(data.cardValue);
                    }
                }
                break;
            case 'playAssistCard':
                this.updateOpponentStack('assist', -1, false);
                break;
        }
    }

    handleTurnUpdate({ isPlayerTurn }) {
        console.log('Handling turn update:', isPlayerTurn);
        this.isPlayerTurn = isPlayerTurn;
        this.updateTurnIndicator();
        if (this.isPlayerTurn) {
            if (this.decks) {
                if (this.decks.number && this.decks.number.visual) {
                    this.decks.number.visual.setInteractive();
                }
                if (this.decks.assist && this.decks.assist.visual) {
                    this.decks.assist.visual.setInteractive();
                }
            }
        } else {
            this.disableAllInteractions();
        }
    }

    createOpponentHand() {
        // Main container for opponent's hand
        this.opponentHand.container = this.add.container(400, 80);
        
        // Add background
        const handBackground = this.add.rectangle(
            0, 0,
            700, 120,
            0xf0f0f0
        ).setAlpha(0.3);
        
        // Add label
        const label = this.add.text(
            0, -50,
            "Opponent's Hand",
            {
                fontSize: '20px',
                color: '#000000'
            }
        ).setOrigin(0.5);

        // Create containers for each stack
        this.opponentHand.numberStack.container = this.add.container(-150, 0);
        this.opponentHand.assistStack.container = this.add.container(150, 0);

        // Add stack labels
        const numberLabel = this.add.text(
            -150, -30,
            'Number Cards',
            { fontSize: '16px', color: '#000000' }
        ).setOrigin(0.5);

        const assistLabel = this.add.text(
            150, -30,
            'Assist Cards',
            { fontSize: '16px', color: '#000000' }
        ).setOrigin(0.5);

        // Add everything to main container
        this.opponentHand.container.add([
            handBackground,
            label,
            numberLabel,
            assistLabel,
            this.opponentHand.numberStack.container,
            this.opponentHand.assistStack.container
        ]);
    }

    updateOpponentHand(cardCount) {
        if (!this.opponentHand?.container) {
            console.error('Opponent hand container not initialized');
            return;
        }
        
        console.log('Updating opponent hand display:', cardCount);

        // Remove old card backs
        this.opponentHand.numberStack.container.removeAll();
        this.opponentHand.assistStack.container.removeAll();

        // Keep background and label
        const background = this.opponentHand.container.list[0];
        const label = this.opponentHand.container.list[1];
        this.opponentHand.container.removeAll();
        this.opponentHand.container.add([background, label]);
        
        this.opponentHand.numberStack.count = cardCount;
        this.opponentHand.assistStack.count = 0;

        // Constants for card layout
        const cardWidth = CARD_DIMENSIONS.width * 0.7; // Make opponent cards slightly smaller
        const cardHeight = CARD_DIMENSIONS.height * 0.7;
        const cardSpacing = 30;
        const maxVisibleCards = 10;
        
        // Calculate total width needed and starting position
        const totalWidth = Math.min(cardCount, maxVisibleCards) * (cardWidth + cardSpacing) - cardSpacing;
        const startX = -totalWidth / 2;

        // Create face-down cards with animation for changes
        for (let i = 0; i < cardCount; i++) {
            const x = startX + i * (cardWidth + cardSpacing);
            
            // Create card back sprite using actual card back texture
            const cardBack = this.add.sprite(x, 0, ASSET_KEYS.numberCard)
                .setDisplaySize(cardWidth, cardHeight)
                .setOrigin(0.5);

            // Add shine effect on card back
            const shine = this.add.graphics();
            shine.lineStyle(2, 0xffffff, 0.5);
            shine.lineBetween(x - cardWidth/3, -cardHeight/3, x + cardWidth/3, cardHeight/3);
            
            // Add to container and track
            this.opponentHand.container.add([cardBack, shine]);
        }

        // Add card count text with background
        if (cardCount > 0) {
            const countBackground = this.add.rectangle(
                0,
                cardHeight/2 + 15,
                80,
                30,
                0x000000,
                0.6
            ).setOrigin(0.5);

            const countText = this.add.text(
                0,
                cardHeight/2 + 15,
                `${cardCount} cards`,
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            
            this.opponentHand.container.add([countBackground, countText]);
        }
    }

    preload() {
        // Load card textures
        this.load.image(ASSET_KEYS.numberCard, 'assets/images/cards/number-card-back.jpeg');
        this.load.image(ASSET_KEYS.assistCard, 'assets/images/cards/assist-card-back.jpeg');
        
        // Load cup textures
        this.load.image(ASSET_KEYS.cupWhite, 'assets/images/cups/cup-white.jpeg');
        this.load.image(ASSET_KEYS.cupPurple, 'assets/images/cups/cup-purple.jpg');
        this.load.image(ASSET_KEYS.cupRed, 'assets/images/cups/cup-red.jpg');
        this.load.image(ASSET_KEYS.cupGreen, 'assets/images/cups/cup-green.jpg');
        this.load.image(ASSET_KEYS.cupBrown, 'assets/images/cups/cup-brown.jpg');
        
        // Create white card front texture
        const cardFront = this.make.graphics();
        cardFront.fillStyle(0xffffff, 1);
        cardFront.fillRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        cardFront.lineStyle(2, 0x000000);
        cardFront.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        cardFront.generateTexture(ASSET_KEYS.cardFront, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        cardFront.destroy();
    }

    create() {
        if (!this.gameState || !this.gameState.tiles) {
            console.error('No game state available');
            return;
        }

        console.log('Creating game scene with state:', this.gameState);

        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;
        
        // Calculate grid dimensions
        const tileSize = Math.min(gameWidth, gameHeight) * 0.12;
        const tileSpacing = tileSize * 0.15;
        const gridWidth = (tileSize * 3) + (tileSpacing * 2);
        const gridHeight = (tileSize * 3) + (tileSpacing * 2);
        
        // Calculate grid position
        const centerX = gameWidth / 2;
        const centerY = gameHeight / 2;
        const gridStartX = centerX - (gridWidth / 2);
        const gridStartY = centerY - (gridHeight / 2);

        // Setup grid positions
        const positions = [
            // Top row
            { x: gridStartX, y: gridStartY },
            { x: gridStartX + tileSize + tileSpacing, y: gridStartY },
            { x: gridStartX + (tileSize * 2) + (tileSpacing * 2), y: gridStartY },
            
            // Middle row (sides only)
            { x: gridStartX, y: gridStartY + tileSpacing + tileSize },
            { x: gridStartX + (tileSize * 2) + (tileSpacing * 2), y: gridStartY + tileSpacing + tileSize },
            
            // Bottom row
            { x: gridStartX, y: gridStartY + (tileSize * 2) + (tileSpacing * 2) },
            { x: gridStartX + tileSize + tileSpacing, y: gridStartY + (tileSize * 2) + (tileSpacing * 2) },
            { x: gridStartX + (tileSize * 2) + (tileSpacing * 2), y: gridStartY + (tileSize * 2) + (tileSpacing * 2) }
        ];

        // Create tiles based on server's game state
        this.tiles = [];
        this.gameState.tiles.forEach((tileData, index) => {
            const pos = positions[index];
            const cupColor = tileData.cupColor;
            const assetKey = ASSET_KEYS[cupColor.split('-').map((part, i) => 
                i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
            ).join('')];
            
            console.log('Creating tile:', {
                position: index,
                hasCup: tileData.hasCup,
                cupColor: tileData.cupColor,
                assetKey: assetKey
            });
            
            const tile = new Tile(
                this,
                pos.x + (tileSize/2),
                pos.y + (tileSize/2),
                tileSize,
                assetKey
            );
            this.tiles.push(tile);

            // Apply any existing numbers
            if (tileData.hasNumber) {
                tile.setNumber(tileData.number);
            }

            tile.sprite.setInteractive({ useHandCursor: true });
            tile.sprite.on('pointerdown', () => this.onTileClick(tile, index));
        });

        // Create hand
        const handWidth = gameWidth * 0.6;
        const handX = centerX - (handWidth / 2);
        const handY = gameHeight - 150;
        this.hand = new Hand(
            this,
            handX,
            handY,
            handWidth
        );

        // Create decks
        this.deckY = gridStartY + (gridHeight / 2);
        this.decks = {
            number: new Deck(
                this,
                centerX - (gridWidth * 0.8),
                this.deckY,
                'number'
            ),
            assist: new Deck(
                this,
                centerX + (gridWidth * 0.8),
                this.deckY,
                'assist'
            )
        };

        // Make decks interactive
        Object.values(this.decks).forEach(deck => {
            deck.visual.setInteractive({ useHandCursor: true });
            deck.visual.on('pointerdown', () => this.onDeckClick(deck));
        });

        // Create discard pile
        const discardX = handX + handWidth + CARD_DIMENSIONS.width/2 + 20;
        this.discardPile = new DiscardPile(
            this,
            discardX,
            handY + CARD_DIMENSIONS.height/2
        );

        // Add total points display
        this.pointsText = this.add.text(
            this.scale.width - 20,
            20,
            `Total Points: ${this.gameState.scores[this.playerId] || 0}`,
            {
                fontSize: '24px',
                color: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        )
        .setOrigin(1, 0)
        .setDepth(1000);

        // Add turn indicator
        this.turnText = this.add.text(
            20,
            20,
            '',
            {
                fontSize: '24px',
                color: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        )
        .setOrigin(0, 0)
        .setDepth(1000);

        // Set initial turn state
        this.updateTurnIndicator();
        if (this.isPlayerTurn) {
            this.enableAllInteractions();
        } else {
            this.disableAllInteractions();
        }

        // Add opponent's hand display
        this.createOpponentHand();

        console.log('Game scene created successfully');
    }

    updateTurnIndicator() {
        if (this.turnText) {
            this.turnText.setText(this.isPlayerTurn ? 'Your Turn' : "Opponent's Turn");
            this.turnText.setBackgroundColor(this.isPlayerTurn ? '#90EE90' : '#FFB6C1');
        }
    }

    onDeckClick(deck) {
        if (!this.isPlayerTurn) {
            this.showWarning('Not your turn!');
            return;
        }

        if (this.hand.cards.length >= 10) {
            this.showWarning('Hand is full!');
            return;
        }

        const card = deck.drawCard();
        if (card) {
            const added = this.hand.addCard(card);
            if (added) {
                card.flip();
                // Notify server
                this.socket.emit('gameAction', {
                    roomId: this.roomId,
                    action: 'drawCard',
                    data: { deckType: deck.type }
                });
            } else {
                card.destroy();
            }
        }
    }

    onTileClick(tile, tileIndex) {
        if (!this.isPlayerTurn) {
            this.showWarning('Not your turn!');
            return;
        }

        if (!this.selectedCard) return;

        if (this.selectedCard.type === 'number' && !tile.hasNumber) {
            if (tile.applyCard(this.selectedCard)) {
                // Notify server about the move
                this.socket.emit('gameAction', {
                    roomId: this.roomId,
                    action: 'playCard',
                    data: {
                        tileIndex,
                        cardValue: this.selectedCard.value
                    }
                });
                
                // Move card to discard pile
                const card = this.selectedCard;
                this.hand.removeCard(card);
                this.selectedCard = null;
                this.discardPile.addCard(card);

                // Update total points from server state
                this.totalPoints = this.gameState.scores[this.playerId] || 0;
                this.pointsText.setText(`Total Points: ${this.totalPoints}`);

                // Check game over
                if (this.gameState.tiles.every(t => t.hasNumber)) {
                    this.gameOver();
                }
            }
        } else if (this.selectedCard.type === 'assist') {
            if (this.selectedCard.value === 'bye-bye') {
                this.activateByeByeCard(this.selectedCard);
            } else if (this.selectedCard.value === 'meowster') {
                this.activateMeowsterCard(this.selectedCard);
            }
            // Add other assist card effects here
        }
    }

    onCardClick(card) {
        if (!this.isPlayerTurn) {
            if (card.deselect) card.deselect();
            if (card.lower) card.lower();
            return;
        }

        if (!card.getData) {
            console.error('Card missing getData method');
            return;
        }

        const cardData = card.getData();
        this.socket.emit('gameAction', {
            action: 'cardPlayed',
            data: {
                value: cardData.value,
                x: cardData.x,
                y: cardData.y
            }
        });
    }

    activateByeByeCard(card) {
        // Check if there are any number cards placed
        const hasPlacedCards = this.tiles.some(tile => tile.hasNumber);
        if (!hasPlacedCards) {
            this.showWarning('No cards to remove!');
            return;
        }

        // Remove all number cards from tiles
        this.tiles.forEach(tile => {
            if (tile.hasNumber) {
                tile.removeNumber();
            }
        });

        // Update total points
        this.totalPoints = 0;
        this.pointsText.setText('Total Points: 0');

        // Clear card's description and deselect before moving to discard pile
        card.lower();
        card.deselect();

        // Move card to discard pile
        this.hand.removeCard(card);
        this.selectedCard = null;
        this.discardPile.addCard(card);
    }

    activateMeowsterCard(card) {
        // Disable all interactive elements while effect is active
        this.disableAllInteractions();

        // Check if there are any assist cards in the discard pile
        const assistCards = this.discardPile.cards.filter(c => c.type === 'assist');
        if (assistCards.length === 0) {
            this.showWarning('No assist cards in discard pile!');
            // Re-enable interactions
            this.enableAllInteractions();
            return;
        }

        // Clear the description of the Meowster card
        card.lower();
        card.deselect();

        // Create a semi-transparent overlay
        const overlay = this.add.rectangle(
            0, 0,
            this.scale.width,
            this.scale.height,
            0x000000, 0.7
        ).setOrigin(0).setDepth(2000);

        // Create title text
        const titleText = this.add.text(
            this.scale.width/2,
            100,
            'Select an assist card from discard pile',
            {
                fontSize: '32px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5).setDepth(2001);

        // Display assist cards from discard pile
        const cardSpacing = CARD_DIMENSIONS.width + 40;
        const startX = this.scale.width/2 - (assistCards.length * cardSpacing)/2 + CARD_DIMENSIONS.width/2;
        
        const cardButtons = assistCards.map((discardedCard, index) => {
            const x = startX + index * cardSpacing;
            const y = this.scale.height/2;

            // Create a container for the card and its elements
            const container = this.add.container(x, y);
            container.setDepth(2002);

            // Add highlight effect
            const highlight = this.add.rectangle(
                0, 0,
                CARD_DIMENSIONS.width + 20,
                CARD_DIMENSIONS.height + 20,
                0xffffff, 0.3
            );

            // Create a new card instance for display
            const displayCard = new Card(this, 0, 0, 'assist', discardedCard.value);
            displayCard.flip();
            
            // Set proper depth for all card elements
            if (displayCard.frontSprite) displayCard.frontSprite.setDepth(2003);
            if (displayCard.text) displayCard.text.setDepth(2004);
            if (displayCard.border) displayCard.border.setDepth(2003);
            
            // Add card description
            const descText = this.add.text(
                0,
                CARD_DIMENSIONS.height/2 + 30,
                ASSIST_CARDS[discardedCard.value].description,
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    backgroundColor: '#000000',
                    padding: { x: 10, y: 5 },
                    align: 'center',
                    wordWrap: { width: CARD_DIMENSIONS.width + 20 }
                }
            ).setOrigin(0.5).setDepth(2004);

            // Add all elements to container
            container.add([highlight, displayCard.frontSprite, displayCard.text]);
            if (displayCard.border) container.add(displayCard.border);
            container.add(descText);

            // Add hitbox on top of everything with highest depth
            const hitArea = this.add.rectangle(
                0, 0,
                CARD_DIMENSIONS.width + 40,
                CARD_DIMENSIONS.height + 60,
                0xffffff, 0
            ).setOrigin(0.5).setDepth(2005);
            container.add(hitArea);

            // Make the hitbox interactive
            hitArea.setInteractive({
                useHandCursor: true
            })
            .on('pointerover', () => {
                highlight.setAlpha(0.5);
            })
            .on('pointerout', () => {
                highlight.setAlpha(0.3);
            })
            .on('pointerdown', async () => {
                // First check if hand has space
                if (this.hand.cards.length >= 10) {
                    this.showWarning('Hand is full!');
                    return;
                }

                // Move Meowster card to discard pile first
                this.hand.removeCard(card);
                this.selectedCard = null;
                this.discardPile.addCard(card);

                // Clean up selection UI
                overlay.destroy();
                titleText.destroy();
                cardButtons.forEach(btn => {
                    btn.container.destroy();
                    btn.displayCard.destroy();
                });
                if (cancelButton?.active) cancelButton.destroy();

                // Create new card at the next available position in hand
                const handPosition = this.hand.getNextCardPosition();
                const newCard = new Card(this, handPosition.x, handPosition.y, 'assist', discardedCard.value);
                this.hand.addCard(newCard);
                await newCard.flip();

                // Re-enable interactions after effect is complete
                this.enableAllInteractions();
            });

            return {
                container,
                displayCard
            };
        });

        // Add cancel button
        const cancelButton = this.add.text(
            this.scale.width/2,
            this.scale.height - 100,
            'Cancel',
            {
                fontSize: '24px',
                color: '#ffffff',
                backgroundColor: '#ff4444',
                padding: { x: 20, y: 10 }
            }
        )
        .setOrigin(0.5)
        .setDepth(2005)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            cancelButton.setStyle({ backgroundColor: '#ff6666' });
        })
        .on('pointerout', () => {
            cancelButton.setStyle({ backgroundColor: '#ff4444' });
        })
        .on('pointerdown', () => {
            overlay.destroy();
            titleText.destroy();
            cardButtons.forEach(btn => {
                btn.container.destroy();
                btn.displayCard.destroy();
            });
            cancelButton.destroy();

            // Re-enable interactions when cancelled
            this.enableAllInteractions();
        });
    }

    disableAllInteractions() {
        if (this.hand && this.hand.cards) {
            this.hand.cards.forEach(c => {
                if (c.frontSprite) c.frontSprite.disableInteractive();
                if (c.backSprite) c.backSprite.disableInteractive();
            });
        }

        // Disable decks
        if (this.decks) {
            Object.values(this.decks).forEach(deck => {
                deck.visual?.removeInteractive();
            });
        }

        // Disable tiles
        if (this.tiles) {
            this.tiles.forEach(tile => {
                tile.sprite?.removeInteractive();
            });
        }
    }

    enableAllInteractions() {
        if (this.decks) {
            if (this.decks.number && this.decks.number.visual) {
                this.decks.number.visual.setInteractive();
            }
            if (this.decks.assist && this.decks.assist.visual) {
                this.decks.assist.visual.setInteractive();
            }
        }
    }

    showWarning(message) {
        const warningText = this.add.text(
            this.scale.width/2,
            this.scale.height/2,
            message,
            {
                fontSize: '24px',
                color: '#ff0000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5);
        
        this.time.delayedCall(1000, () => warningText.destroy());
    }

    gameOver() {
        this.disableAllInteractions();
        
        // Add game over text in the center of the screen
        const gameOverText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            'Game Over!',
            {
                fontSize: '48px',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(2001);

        // Show final score
        const finalScoreText = this.add.text(
            this.scale.width/2,
            this.scale.height/2 + 50,
            `Final Score: ${this.totalPoints}`,
            {
                fontSize: '32px',
                color: '#ffffff'
            }
        ).setOrigin(0.5).setDepth(2001);

        // Add restart button
        const restartButton = this.add.text(
            this.scale.width/2,
            this.scale.height/2 + 150,
            'Play Again',
            {
                fontSize: '24px',
                color: '#ffffff',
                backgroundColor: '#4a4a4a',
                padding: { x: 20, y: 10 }
            }
        )
        .setOrigin(0.5)
        .setDepth(2001)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.scene.restart();
        });
    }

    startTurn() {
        this.isPlayerTurn = true;
        this.updateTurnIndicator();
        this.enableAllInteractions();
    }

    endTurn() {
        this.isPlayerTurn = false;
        this.updateTurnIndicator();
        this.disableAllInteractions();
        this.socket.emit('gameAction', {
            roomId: this.roomId,
            action: 'endTurn'
        });
    }

    showGameOver(message) {
        this.disableAllInteractions();
        
        // Add game over text in the center of the screen
        const gameOverText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            message,
            {
                fontSize: '32px',
                fill: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);
    }

    updateOpponentStack(deckType, change, animate = false) {
        const stack = deckType === 'number' ? 
            this.opponentHand.numberStack : 
            this.opponentHand.assistStack;
        
        // Clear existing cards
        stack.container.removeAll();
        
        // Update count
        stack.count = Math.max(0, stack.count + change);
        
        // Constants for card layout
        const cardWidth = CARD_DIMENSIONS.width * 0.7;
        const cardHeight = CARD_DIMENSIONS.height * 0.7;
        const cardSpacing = 10;
        const maxVisibleCards = 5;
        
        // Create visual representation of cards
        for (let i = 0; i < Math.min(stack.count, maxVisibleCards); i++) {
            const cardBack = this.add.container(i * cardSpacing, i * cardSpacing);
            
            // Create card back with appropriate texture
            const cardSprite = this.add.sprite(0, 0, 
                deckType === 'number' ? ASSET_KEYS.numberCard : ASSET_KEYS.assistCard
            ).setDisplaySize(cardWidth, cardHeight);
            
            cardBack.add(cardSprite);
            
            if (animate && i === stack.count - 1) {
                cardBack.setScale(0);
                this.tweens.add({
                    targets: cardBack,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            }
            
            stack.container.add(cardBack);
        }
        
        // Add count text if there are more cards than visible
        if (stack.count > maxVisibleCards) {
            const countText = this.add.text(
                (maxVisibleCards - 1) * cardSpacing + cardWidth/2,
                (maxVisibleCards - 1) * cardSpacing + cardHeight/2,
                `+${stack.count - maxVisibleCards}`,
                {
                    fontSize: '16px',
                    color: '#000',
                    backgroundColor: '#fff',
                    padding: { x: 4, y: 2 }
                }
            ).setOrigin(0.5);
            
            stack.container.add(countText);
        }
    }
} 