import { Scene, GameObjects } from 'phaser';
import type { Room } from 'colyseus.js';
import { SocketManager } from '../managers/SocketManager';
import type { GameScene as IGameScene, GameState as IGameState } from '../types/game';

interface CupPosition {
    x: number;
    y: number;
}

interface GameState extends IGameState {
    tiles: Array<{
        cupColor?: string;
        tileIndex?: number;
        hasNumber?: boolean;
        number?: number;
    }>;
    currentPlayer: string;
    players: Map<string, {
        id: string;
        ready: boolean;
        hasDrawnAssist: boolean;
        hasDrawnNumber: boolean;
        score: number;
        hand: Array<any>;
    }>;
}

interface InitData {
    room: Room;
    roomCode: string;
    playerId: string;
    currentTurn: string;
    gameState: GameState;
}

export default class GameScene extends Scene implements IGameScene {
    socket: Room | null = null;
    roomCode: string | null = null;
    players: Map<string, any> | null = null;
    currentTurn: string | null = null;
    isPlayerTurn: boolean = false;
    playerId: string = '';
    currentPhase: string = 'assist_phase';
    hasDrawnAssist: boolean = false;
    hasDrawnNumber: boolean = false;
    isDestroyed: boolean = false;
    turnManager: any = null;
    isInitialized: boolean = false;
    cupPositions: CupPosition[] = [
        { x: 219, y: 975 }, // bottom left (0)
        { x: 445, y: 979 }, // bottom middle (1)
        { x: 666, y: 981 }, // bottom right (2)
        { x: 222, y: 730 }, // middle left (3)
        { x: 666, y: 726 }, // middle right (4)
        { x: 222, y: 516 }, // top left (5)
        { x: 440, y: 511 }, // top middle (6)
        { x: 666, y: 507 }, // top right (7)
        { x: 440, y: 730 }  // center (8)
    ];
    socketManager: SocketManager | null = null;
    gameState: GameState | null = null;
    initData: InitData | null = null;
    messageText: GameObjects.Text | null = null;
    turnText: GameObjects.Text | null = null;
    boardManager: any = null;

    constructor(boardManager?: any) {
        super({
            key: 'GameScene',
            active: false
        });
        this.resetScene();
        // Initialize boardManager with the provided parameter if available
        if (boardManager) {
            this.boardManager = boardManager;
        }
    }

    private resetScene(): void {
        this.socket = null;
        this.roomCode = null;
        this.players = null;
        this.currentTurn = null;
        this.isPlayerTurn = false;
        this.playerId = '';
        this.currentPhase = 'assist_phase';  // Reset to default phase
        this.hasDrawnAssist = false;
        this.hasDrawnNumber = false;
        this.isDestroyed = false;
        this.turnManager = null;
        this.isInitialized = false;
        this.socketManager = null;
        this.gameState = null;
        this.initData = null;
        this.messageText = null;
        this.turnText = null;
        this.boardManager = null;
    }

    init(data?: InitData): void {
        console.log('GameScene init called with data:', data);
        
        // Reset scene first
        this.resetScene();

        // Handle Phaser's internal scene initialization
        if (!data || Object.keys(data).length === 0) {
            console.log('Internal Phaser initialization, waiting for game data...');
            return;
        }

        try {
            // Validate required data
            if (!data.room || !data.roomCode || !data.playerId || !data.gameState) {
                const missingFields = [];
                if (!data.room) missingFields.push('room');
                if (!data.roomCode) missingFields.push('roomCode');
                if (!data.playerId) missingFields.push('playerId');
                if (!data.gameState) missingFields.push('gameState');
                
                const error = new Error(`Missing required game data: ${missingFields.join(', ')}`);
                console.error('Initialization error:', error.message, data);
                this.events.emit('gameError', error.message);
                throw error;
            }
            
            // Store initialization data
            this.initData = data;
            
            // Initialize basic properties
            this.socket = data.room;
            this.roomCode = data.roomCode;
            this.playerId = data.playerId;
            this.currentTurn = data.currentTurn;
            this.isPlayerTurn = this.currentTurn === this.playerId;
            this.currentPhase = 'assist_phase';
            this.hasDrawnAssist = false;
            this.hasDrawnNumber = false;
            this.gameState = data.gameState;

            // Set up message handlers
            if (this.socket) {
                // @ts-ignore: Colyseus type definitions need to be updated
                this.socket.onMessage("*", (type: string | number, message: any) => {
                    if (this.isDestroyed) return;
                    
                    if (type === 'gameState' && message) {
                        console.log('Game state update received:', message);
                        this.handleGameUpdate({
                            type: 'gameState',
                            gameState: message
                        });
                    } else if (type === 'error' && message) {
                        console.error('Socket error:', message);
                        this.showErrorMessage(message.error);
                    } else if (type === 'disconnect') {
                        console.log('Disconnected from server');
                        this.showErrorMessage('Disconnected from server');
                    } else if (type === 'gameEnded' && message && this.isInitialized) {
                        console.log('Game ended:', message);
                        this.events.emit('gameError', message.reason);
                    } else if (type === 'cardDrawn' && message) {
                        console.log('Card drawn:', message);
                        this.handleCardDrawn(message);
                    }
                });
            }

            console.log('Game properties initialized:', {
                roomCode: this.roomCode,
                playerId: this.playerId,
                currentTurn: this.currentTurn,
                isPlayerTurn: this.isPlayerTurn
            });

            // Initialize managers in order
            try {
                this.socketManager = new SocketManager(this, 'wss://your-game-server.com');  // Replace with actual endpoint
                console.log('Socket Manager initialized');

                this.isInitialized = true;
                console.log('Game scene fully initialized with state:', this.gameState);
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Failed to initialize game managers';
                console.error('Error initializing managers:', error);
                this.events.emit('gameError', msg);
                throw error;
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to initialize game scene';
            console.error('Error during scene initialization:', error);
            this.events.emit('gameError', msg);
            throw error;
        }
    }

    preload(): void {
        // Load images
        this.load.image('number-card-back', '/assets/images/cards/number-card-back.jpg');
        this.load.image('assist-card-back', '/assets/images/cards/assist-card-back.jpg');
        
        ['brown', 'green', 'purple', 'red', 'white'].forEach(color => {
            this.load.image(`cup-${color}`, `/assets/images/cups/cup-${color}.jpg`);
        });
    }

    async create(): Promise<void> {
        console.log('Creating game scene...');
        
        try {
            // Check if we have initialization data
            if (!this.initData) {
                console.log('No initialization data available, waiting...');
                return;
            }

            // Check if we're already initialized
            if (!this.isInitialized || !this.gameState) {
                console.log('Scene not initialized or missing game state, retrying initialization...');
                this.init(this.initData);
                return;
            }

            // Create loading text
            const loadingText = this.add.text(
                this.game.config.width as number / 2,
                this.game.config.height as number / 2,
                'Loading game assets...',
                {
                    fontSize: '24px',
                    color: '#ffffff',
                    backgroundColor: '#00000080',
                    padding: { x: 16, y: 8 }
                }
            ).setOrigin(0.5).setDepth(1000);

            // Wait for socket connection before proceeding
            if (this.socket && !(this.socket as any).hasJoined) {
                console.log('Waiting for socket connection...');
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Socket connection timeout'));
                    }, 5000);

                    const checkConnection = () => {
                        if ((this.socket as any)?.hasJoined) {
                            clearTimeout(timeout);
                            resolve();
                        } else if (this.isDestroyed) {
                            clearTimeout(timeout);
                            reject(new Error('Scene destroyed while waiting for connection'));
                        } else {
                            setTimeout(checkConnection, 100);
                        }
                    };
                    checkConnection();
                });
            }

            // Create the game scene elements
            this.editorCreate();

            // Set up game listeners
            this.setupGameListeners();

            // Add window beforeunload listener
            window.addEventListener('beforeunload', (e) => {
                if (this.socket && !this.isDestroyed) {
                    e.preventDefault();
                    e.returnValue = 'Are you sure you want to leave? The game will end.';
                }
            });

            // Initialize UI after scene creation
            if (this.socket && (this.socket as any).hasJoined) {
                try {
                    const message = { ready: true };
                    (this.socket as any).send('gameSceneReady', message);
                    console.log('Game scene ready message sent');
                } catch (error) {
                    console.warn('Failed to send ready message:', error);
                    this.showErrorMessage('Connection lost');
                    return;
                }
            }

            // Remove loading text
            loadingText.destroy();

            // Emit scene-awake event after everything is set up
            console.log('Emitting scene-awake event');
            this.events.emit('scene-awake');

        } catch (error) {
            console.error('Error in create:', error);
            this.events.emit('gameError', 'Failed to create game scene');
        }
    }

    shutdown(): void {
        if (this.isInitialized) {
            // Remove the beforeunload listener
            window.removeEventListener('beforeunload', () => {});

            if (this.socketManager) {
                this.socketManager.cleanup();
            }
            if (this.socket && !this.isDestroyed) {
                try {
                    this.socketManager?.exitRoom();
                } catch (error) {
                    console.error('Error leaving room during shutdown:', error);
                }
            }
            
            this.resetScene();
            console.log('Game scene cleaned up');
        }
    }

    private editorCreate(): void {
        if (!this.isInitialized || !this.gameState) {
            console.log('Skipping editorCreate until game data is received');
            return;
        }

        const gameBoard = this.add.container(0, 0);

        // Add turn indicator text at the top of the screen
        this.turnText = this.add.text(
            this.game.config.width as number / 2,
            100,
            this.isPlayerTurn ? 'Your Turn!' : "Opponent's Turn",
            {
                fontFamily: 'sans-serif',
                fontSize: '24px',
                color: this.isPlayerTurn ? '#4ADE80' : '#FB7185',
                backgroundColor: '#1F2937',
                padding: { x: 16, y: 8 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(100);

        // Setup game board
        this.gameState.tiles.forEach((tileData, index) => {
            if (index === 8) return;
            
            const position = this.cupPositions[index];
            if (position && tileData.cupColor) {
                const cup = this.add.image(position.x, position.y, `cup-${tileData.cupColor}`);
                cup.setScale(0.16);
                gameBoard.add(cup);
            }
        });

        // Setup card decks with improved animations
        this.setupCardDeck('number', 383, 735, 0.16);
        this.setupCardDeck('assist', 496, 734, 0.22);

        // Create player's hand container
        const handContainer = this.add.container(this.game.config.width as number / 2, 1300);
        handContainer.setName('player-hand');
        
        // Create and style exit button
        const exit_room_button = this.add.rectangle(163, 119, 128, 48, 0x4B5563); // Gray-600 color
        exit_room_button.name = "exit_room_button";
        exit_room_button.setScale(1.54, 0.85);
        exit_room_button.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                exit_room_button.setFillStyle(0x374151); // Gray-700 for hover
                exit_room_button.setScale(1.6, 0.9); // Scale up slightly
            })
            .on('pointerout', () => {
                exit_room_button.setFillStyle(0x4B5563); // Back to Gray-600
                exit_room_button.setScale(1.54, 0.85);
            });

        // Add text to exit button
        const exitText = this.add.text(163, 119, 'Exit Room', {
            fontFamily: 'sans-serif',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Create and style end turn button
        const end_turn_button = this.add.rectangle(723, 1481, 128, 48, 0x4B5563); // Gray-600 color
        end_turn_button.name = "end_turn_button";
        end_turn_button.setScale(1.54, 0.85);

        // Update button state based on turn conditions
        const updateEndTurnButtonState = () => {
            const canEndTurn = this.isPlayerTurn && this.hasDrawnAssist && this.hasDrawnNumber;
            end_turn_button.setFillStyle(canEndTurn ? 0x4B5563 : 0x374151); // Gray-600 if active, Gray-700 if disabled
            end_turn_button.setAlpha(canEndTurn ? 1 : 0.5);
            
            // Remove previous interaction if exists
            end_turn_button.removeInteractive();
            
            if (canEndTurn) {
                end_turn_button.setInteractive({ useHandCursor: true });
            }
        };

        // Initial state
        updateEndTurnButtonState();

        // Add button interactions
        end_turn_button.on('pointerover', () => {
            if (this.isPlayerTurn && this.hasDrawnAssist && this.hasDrawnNumber) {
                end_turn_button.setFillStyle(0x374151); // Gray-700 for hover
                end_turn_button.setScale(1.6, 0.9); // Scale up slightly
            }
        })
        .on('pointerout', () => {
            if (this.isPlayerTurn && this.hasDrawnAssist && this.hasDrawnNumber) {
                end_turn_button.setFillStyle(0x4B5563); // Back to Gray-600
                end_turn_button.setScale(1.54, 0.85);
            }
        })
        .on('pointerdown', () => {
            if (this.isPlayerTurn && this.hasDrawnAssist && this.hasDrawnNumber && this.socketManager) {
                console.log('End turn button clicked');
                this.socketManager.endTurn();
                // Reset player's draw states
                this.hasDrawnAssist = false;
                this.hasDrawnNumber = false;
                // Update button state
                updateEndTurnButtonState();
            }
        });

        // Add text to end turn button
        const endTurnText = this.add.text(723, 1481, 'End Turn', {
            fontFamily: 'sans-serif',
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Update button state when turn state changes
        this.events.on('turnStateChanged', updateEndTurnButtonState);

        this.events.emit("scene-awake");
    }

    private setupGameListeners(): void {
        this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: GameObjects.GameObject) => {
            if (gameObject.name === "exit_room_button" && this.socketManager) {
                console.log('Exit button clicked');
                this.handleExitRoom();
                return;
            }

            if (!this.isPlayerTurn) return;

            const gameObjectWithType = gameObject as GameObjects.GameObject & { type: string; tileIndex?: number };

            if (gameObjectWithType.type === 'Card' && this.socketManager) {
                this.socketManager.emitCardSelect(gameObject);
            } else if (gameObjectWithType.type === 'Tile' && gameObjectWithType.tileIndex !== undefined && this.socketManager) {
                this.socketManager.emitTileClick(gameObjectWithType.tileIndex);
            }
        });
    }

    private handleExitRoom(): void {
        if (!this.socketManager || !this.socket) {
            console.warn('Cannot exit room: Socket manager or socket not initialized');
            return;
        }

        try {
            // First notify the server that we're leaving
            this.socketManager.exitRoom();
            
            // Clean up the current scene
            this.isDestroyed = true;
            
            // Navigate back to lobby using window.location
            window.location.href = '/';
        } catch (error) {
            console.error('Error exiting room:', error);
            this.showErrorMessage('Failed to exit room properly');
            // Still try to navigate to lobby in case of error
            window.location.href = '/';
        }
    }

    handleGameUpdate(data: { type: string; gameState: GameState }): void {
        console.log('Handling game update:', data);
        
        if (!data) return;

        if (data.type === 'gameState' && data.gameState) {
            const state = data.gameState;
            this.currentTurn = state.currentPlayer;
            this.isPlayerTurn = this.currentTurn === this.playerId;
            
            // Update player's draw states from server state
            const player = state.players.get(this.playerId);
            if (player) {
                this.hasDrawnAssist = player.hasDrawnAssist;
                this.hasDrawnNumber = player.hasDrawnNumber;
            }
            
            // Update turn indicator text
            if (this.turnText) {
                this.turnText.setText(this.isPlayerTurn ? 'Your Turn!' : "Opponent's Turn");
                this.turnText.setColor(this.isPlayerTurn ? '#4ADE80' : '#FB7185');
            }

            this.gameState = state;
            
            // Emit turn state changed event to update button
            this.events.emit('turnStateChanged');
        }
    }

    private handleCardDrawn(data: { type: 'assist' | 'number', card: any }): void {
        const { type, card } = data;
        
        // Don't update state here - wait for server state update
        console.log('Card drawn, waiting for server state update:', data);

        // Create and display the card in hand
        const handContainer = this.children.getByName('player-hand') as Phaser.GameObjects.Container;
        if (!handContainer) {
            console.error('Hand container not found');
            return;
        }

        // Get the source deck position
        const sourceDeck = this.children.getByName(`${type}-deck`) as Phaser.GameObjects.Image;
        if (!sourceDeck) {
            console.error('Source deck not found');
            return;
        }

        // Create the card sprite at the deck's position
        const cardSprite = this.add.image(sourceDeck.x, sourceDeck.y, `${type}-card-${card.value}`);
        cardSprite.setScale(type === 'assist' ? 0.22 : 0.16);
        cardSprite.setDepth(100); // Ensure card appears above other elements during animation
        
        // Calculate final position in hand
        const currentCards = (handContainer as any).list.length;
        const cardWidth = cardSprite.width * cardSprite.scaleX;
        const spacing = cardWidth + 10;
        const totalWidth = (currentCards + 1) * spacing;
        const startX = -totalWidth / 2;

        // Reposition existing cards in hand with animation
        (handContainer as any).list.forEach((child: GameObjects.Image, index: number) => {
            this.add.tween({
                targets: child,
                x: startX + (index * spacing),
                duration: 300,
                ease: 'Back.easeOut'
            });
        });

        // Animate the card from deck to hand
        this.add.tween({
            targets: cardSprite,
            x: handContainer.x + startX + (currentCards * spacing),
            y: handContainer.y,
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Add card to hand container and clean up
                cardSprite.setDepth(0);
                handContainer.add(cardSprite);
                
                // Add a small bounce effect
                this.add.tween({
                    targets: cardSprite,
                    scaleX: cardSprite.scaleX * 1.1,
                    scaleY: cardSprite.scaleY * 1.1,
                    duration: 100,
                    yoyo: true,
                    ease: 'Quad.easeOut'
                });
            }
        });

        // Add visual feedback on the deck
        this.add.tween({
            targets: sourceDeck,
            scaleX: sourceDeck.scaleX * 0.9,
            scaleY: sourceDeck.scaleY * 0.9,
            duration: 100,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    private setupCardDeck(type: 'assist' | 'number', x: number, y: number, scale: number): void {
        const deck = this.add.image(x, y, `${type}-card-back`);
        deck.setScale(scale);
        deck.setName(`${type}-deck`)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', async () => {
                // Basic validation first
                if (!this.canDrawCard(type)) {
                    const message = type === 'assist' 
                        ? "Already drawn an assist card!"
                        : !this.hasDrawnAssist 
                            ? "Draw assist card first!"
                            : "Already drawn a number card!";
                    this.showErrorMessage(message);
                    return;
                }

                // Disable deck interaction while processing
                deck.disableInteractive();
                deck.setTint(0x666666);

                try {
                    // Create temporary card immediately for better UX
                    const tempCard = {
                        type,
                        value: type === 'assist' ? 'temp' : '?',
                        color: type === 'number' ? 'temp' : undefined
                    };

                    // Show temporary card animation
                    await this.showCardDrawAnimation(type, tempCard, deck);

                    // Update local state
                    if (type === 'assist') {
                        this.hasDrawnAssist = true;
                    } else {
                        this.hasDrawnNumber = true;
                    }

                    // Try to notify server about the draw, but don't wait for response
                    if (this.socketManager) {
                        this.socketManager.drawCard(type).catch(error => {
                            console.warn('Failed to notify server about card draw:', error);
                        });
                    }

                } catch (error) {
                    console.error(`Error in card draw process:`, error);
                    this.showErrorMessage(error instanceof Error ? error.message : "Failed to draw card");
                } finally {
                    // Cleanup
                    deck.clearTint();
                    deck.setInteractive({ useHandCursor: true });
                }
            });

        // Add hover effects
        deck.on('pointerover', () => {
            if (this.canDrawCard(type)) {
                deck.setTint(0xaaaaaa);
                this.add.tween({
                    targets: deck,
                    scaleX: scale * 1.05,
                    scaleY: scale * 1.05,
                    duration: 100,
                    ease: 'Quad.easeOut'
                });
            }
        }).on('pointerout', () => {
            deck.clearTint();
            this.add.tween({
                targets: deck,
                scaleX: scale,
                scaleY: scale,
                duration: 100,
                ease: 'Quad.easeOut'
            });
        });
    }

    private async showCardDrawAnimation(type: 'assist' | 'number', card: any, sourceDeck: Phaser.GameObjects.Image): Promise<void> {
        const handContainer = this.children.getByName('player-hand') as Phaser.GameObjects.Container;
        if (!handContainer) {
            throw new Error('Hand container not found');
        }

        // Create the card sprite at the deck's position
        const cardSprite = this.add.image(sourceDeck.x, sourceDeck.y, `${type}-card-back`);
        cardSprite.setScale(type === 'assist' ? 0.22 : 0.16);
        cardSprite.setDepth(100);

        // Calculate final position in hand
        const currentCards = (handContainer as any).list.length;
        const cardWidth = cardSprite.width * cardSprite.scaleX;
        const spacing = cardWidth + 10;
        const totalWidth = (currentCards + 1) * spacing;
        const startX = -totalWidth / 2;

        // Reposition existing cards
        (handContainer as any).list.forEach((child: GameObjects.Image, index: number) => {
            this.add.tween({
                targets: child,
                x: startX + (index * spacing),
                duration: 300,
                ease: 'Back.easeOut'
            });
        });

        // Animate card to hand
        return new Promise((resolve) => {
            this.add.tween({
                targets: cardSprite,
                x: handContainer.x + startX + (currentCards * spacing),
                y: handContainer.y,
                duration: 500,
                ease: 'Back.easeOut',
                onComplete: () => {
                    cardSprite.setDepth(0);
                    handContainer.add(cardSprite);
                    
                    // Add bounce effect
                    this.add.tween({
                        targets: cardSprite,
                        scaleX: cardSprite.scaleX * 1.1,
                        scaleY: cardSprite.scaleY * 1.1,
                        duration: 100,
                        yoyo: true,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            resolve();
                        }
                    });
                }
            });

            // Add deck feedback
            this.add.tween({
                targets: sourceDeck,
                scaleX: sourceDeck.scaleX * 0.9,
                scaleY: sourceDeck.scaleY * 0.9,
                duration: 100,
                yoyo: true,
                ease: 'Quad.easeOut'
            });
        });
    }

    private canDrawCard(type: 'assist' | 'number'): boolean {
        if (!this.isPlayerTurn) return false;
        if (type === 'assist') return !this.hasDrawnAssist;
        return this.hasDrawnAssist && !this.hasDrawnNumber;
    }

    showMessage(message: string, duration: number = 2000): void {
        if (!this.messageText) {
            this.messageText = this.add.text(
                this.game.config.width as number / 2,
                80,
                '',
                {
                    fontSize: '24px',
                    color: '#ffffff',
                    backgroundColor: '#00000080',
                    padding: { x: 10, y: 5 }
                }
            )
            .setOrigin(0.5)
            .setDepth(100)
            .setVisible(false);
        }

        this.messageText.setText(message);
        this.messageText.setVisible(true);
        this.messageText.setAlpha(1);

        this.time.delayedCall(duration, () => {
            if (this.messageText) {
                this.messageText.setAlpha(0);
                this.messageText.setVisible(false);
            }
        });
    }

    showErrorMessage(message: string): void {
        this.showMessage(message, 3000);
    }
} 