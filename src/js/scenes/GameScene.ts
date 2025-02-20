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
    isDrawing: boolean = false;

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
        this.isDrawing = false;
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
                        this.handleGameError(message.error);
                    } else if (type === 'disconnect') {
                        console.log('Disconnected from server');
                        this.handleDisconnect();
                    } else if (type === 'gameEnded' && message && this.isInitialized) {
                        console.log('Game ended:', message);
                        this.handleGameEnded(message.reason);
                    } else if (type === 'cardDrawn' && message) {
                        console.log('Card drawn:', message);
                        this.handleCardDrawn(message);
                    }
                });

                // Add error event handler
                this.events.on('gameError', this.handleGameError, this);
            }

            console.log('Game properties initialized:', {
                roomCode: this.roomCode,
                playerId: this.playerId,
                currentTurn: this.currentTurn,
                isPlayerTurn: this.isPlayerTurn
            });

            // Initialize managers in order
            try {
                // Use the same endpoint as GameClient
                const endpoint = process.env.NODE_ENV === 'production'
                    ? 'wss://your-production-url.com'
                    : `ws://${window.location.hostname}:3000`;
                this.socketManager = new SocketManager(this, endpoint);
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
        console.log('Shutting down GameScene');
        
        if (this.isInitialized) {
            // Set destroyed flag first to prevent new operations
            this.isDestroyed = true;
            
            try {
                // Remove the beforeunload listener
                window.removeEventListener('beforeunload', () => {});

                // Clean up socket manager first
                if (this.socketManager) {
                    this.socketManager.cleanup();
                    this.socketManager = null;
                }

                // Clean up game objects safely
                if (this.messageText && this.messageText.scene) {
                    this.messageText.destroy();
                }
                if (this.turnText && this.turnText.scene) {
                    this.turnText.destroy();
                }

                // Reset all state
                this.resetScene();
                console.log('Game scene cleaned up');
            } catch (error) {
                console.error('Error during scene shutdown:', error);
            }
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
        this.input.on('gameobjectdown', (_pointer: Phaser.Input.Pointer, gameObject: GameObjects.GameObject) => {
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

    private animateCardDraw(type: 'assist' | 'number', card: any): void {
        if (this.isDrawing) return;
        this.isDrawing = true;

        const deckPosition = type === 'assist' 
            ? { x: 440, y: 730 } // Center position for assist deck
            : { x: 440, y: 730 }; // Center position for number deck

        // Create the card sprite
        const cardSprite = this.add.sprite(deckPosition.x, deckPosition.y, `${type}-card-back`)
            .setScale(0.8)
            .setDepth(100);

        // Calculate target position based on player's hand area
        const targetX = this.playerId === this.currentTurn ? 219 : 666; // Left for current player, right for opponent
        const targetY = 975; // Bottom of the screen

        // Animate the card draw
        this.tweens.add({
            targets: cardSprite,
            x: { value: targetX, duration: 1000, ease: 'Power2' },
            y: { value: targetY, duration: 500, ease: 'Bounce.easeOut', delay: 150 },
            onComplete: () => {
                // If it's the current player's card, flip it to show the value
                if (this.playerId === this.currentTurn) {
                    this.flipCard(cardSprite, card, type);
                }
                this.isDrawing = false;
            }
        });
    }

    private flipCard(cardSprite: Phaser.GameObjects.Sprite, card: any, type: 'assist' | 'number'): void {
        // Flip animation
        this.tweens.add({
            targets: cardSprite,
            scaleX: 0,
            duration: 300,
            ease: 'Linear',
            onComplete: () => {
                // Change the texture to the front of the card
                const cardTexture = this.createCardTexture(card, type);
                cardSprite.setTexture(cardTexture);
                
                // Flip back
                this.tweens.add({
                    targets: cardSprite,
                    scaleX: 0.8,
                    duration: 300,
                    ease: 'Linear'
                });
            }
        });
    }

    private createCardTexture(card: any, type: 'assist' | 'number'): string {
        // This should return the appropriate texture key for the card
        // You'll need to load these textures in preload()
        if (type === 'assist') {
            return `assist-card-${card.id}`; // Replace with actual texture key format
        } else {
            return `number-card-${card.value}`; // Replace with actual texture key format
        }
    }

    private handleCardDrawn(data: { type: 'assist' | 'number', card: any }): void {
        const { type, card } = data;
        
        // Update game state
        if (this.playerId === this.currentTurn) {
            if (type === 'assist') {
                this.hasDrawnAssist = true;
            } else {
                this.hasDrawnNumber = true;
            }
        }

        // Animate the card draw
        this.animateCardDraw(type, card);

        // Update UI state
        this.updateDeckInteractivity();
        this.updateTurnIndicator();
    }

    private setupCardDeck(type: 'assist' | 'number', x: number, y: number, scale: number): void {
        if (this.isDestroyed) return;

        const deck = this.add.image(x, y, `${type}-card-back`);
        deck.setName(`${type}-deck`)
            .setScale(scale)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                if (!this.isDestroyed && this.isPlayerTurn && this.canDrawCard(type)) {
                    deck.setTint(0xcccccc);
                }
            })
            .on('pointerout', () => !this.isDestroyed && deck.clearTint())
            .on('pointerdown', async () => {
                // Prevent actions if scene is being destroyed
                if (this.isDestroyed) return;

                // Prevent multiple simultaneous draws
                if (this.isDrawing) {
                    console.log('Card draw already in progress');
                    return;
                }

                // Basic validation
                if (!this.isPlayerTurn) {
                    this.showErrorMessage('Not your turn');
                    return;
                }

                if (!this.canDrawCard(type)) {
                    const reason = type === 'assist' 
                        ? 'You have already drawn an assist card'
                        : !this.hasDrawnAssist 
                            ? 'Draw an assist card first'
                            : 'You have already drawn a number card';
                    this.showErrorMessage(reason);
                    return;
                }

                // Disable deck interaction during draw
                deck.disableInteractive();
                deck.setTint(0x999999);
                this.isDrawing = true;

                try {
                    // Create loading animation
                    const loadingText = this.add.text(deck.x, deck.y + 50, 'Drawing...', {
                        fontSize: '16px',
                        color: '#ffffff'
                    }).setOrigin(0.5);

                    // Try to draw card from server first
                    if (!this.socketManager) {
                        throw new Error('Socket manager not initialized');
                    }

                    // Wait for server response before showing animation
                    await this.socketManager.drawCard(type);

                    // Only proceed with updates if scene is still active
                    if (!this.isDestroyed) {
                        // Remove loading text safely
                        if (loadingText && loadingText.scene) {
                            loadingText.destroy();
                        }

                        // Server confirmed the draw, now we can update local state
                        if (type === 'assist') {
                            this.hasDrawnAssist = true;
                        } else {
                            this.hasDrawnNumber = true;
                        }

                        // Update UI to reflect new state
                        this.updateTurnIndicator();
                        this.updateDeckInteractivity();
                    }

                } catch (error) {
                    console.error(`Error in card draw process:`, error);
                    
                    // Only show error if scene is still active
                    if (!this.isDestroyed) {
                        // Show error message
                        this.showErrorMessage(error instanceof Error ? error.message : "Failed to draw card");
                        
                        // Rollback any local state changes
                        if (type === 'assist') {
                            this.hasDrawnAssist = false;
                        } else {
                            this.hasDrawnNumber = false;
                        }
                        
                        // Update UI after rollback
                        this.updateTurnIndicator();
                        this.updateDeckInteractivity();
                    }

                } finally {
                    // Cleanup only if scene is still active
                    if (!this.isDestroyed) {
                        deck.clearTint();
                        if (this.isPlayerTurn && this.canDrawCard(type)) {
                            deck.setInteractive({ useHandCursor: true });
                        }
                    }
                    this.isDrawing = false;
                }
            });
    }

    private canDrawCard(type: 'assist' | 'number'): boolean {
        if (type === 'assist') {
            return !this.hasDrawnAssist;
        }
        return this.hasDrawnAssist && !this.hasDrawnNumber;
    }

    private updateTurnIndicator(): void {
        // Don't update if scene is being destroyed
        if (this.isDestroyed) return;

        try {
            if (this.turnText && this.turnText.scene) {
                this.turnText.setText(this.isPlayerTurn ? 'Your Turn!' : "Opponent's Turn");
                this.turnText.setColor(this.isPlayerTurn ? '#4ADE80' : '#FB7185');
            }
        } catch (error) {
            console.warn('Error updating turn indicator:', error);
        }
    }

    private updateDeckInteractivity(): void {
        if (this.socketManager) {
            this.socketManager.updateDeckInteractivity();
        }
    }

    showMessage(message: string, duration: number = 2000): void {
        // Don't show messages if scene is being destroyed
        if (this.isDestroyed) return;

        try {
            if (!this.messageText || !this.messageText.scene) {
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

            // Only set timeout if scene is still active
            if (!this.isDestroyed) {
                this.time.delayedCall(duration, () => {
                    if (this.messageText && this.messageText.scene && !this.isDestroyed) {
                        this.messageText.setAlpha(0);
                        this.messageText.setVisible(false);
                    }
                });
            }
        } catch (error) {
            console.warn('Error showing message:', error);
        }
    }

    public showErrorMessage(message: string): void {
        if (this.isDestroyed) return;
        
        try {
            // Only show error if scene is still active
            if (this.scene && this.scene.isActive()) {
                this.showMessage(message, 3000);
            }
        } catch (error) {
            console.warn('Failed to show error message:', error);
        }
    }

    private handleGameError(error: string): void {
        console.error('Game error:', error);
        this.showErrorMessage(error);
        
        // Check if error is related to room not found or connection issues
        if (error.includes('room no longer exists') || error.includes('Failed to reconnect')) {
            this.scene.start('LobbyScene', { 
                error: 'Game session ended. Please start a new game.' 
            });
        }
    }

    private handleDisconnect(): void {
        if (this.isDestroyed) return;
        
        console.log('Handling disconnect');
        this.showErrorMessage('Attempting to reconnect...');
        
        // Add a timeout to redirect to lobby if reconnection takes too long
        setTimeout(() => {
            if (!this.isDestroyed && (!this.socket?.connection?.isOpen || !this.socket?.sessionId)) {
                this.isDestroyed = true;
                this.scene.start('LobbyScene', {
                    error: 'Connection lost. Please start a new game.',
                    forceReconnect: true
                });
            }
        }, 10000); // 10 seconds timeout
    }

    private handleGameEnded(reason: string): void {
        console.log('Game ended:', reason);
        this.events.emit('gameError', reason);
        
        // Clean up and return to lobby
        setTimeout(() => {
            this.scene.start('LobbyScene', {
                message: 'Game ended: ' + reason
            });
        }, 2000);
    }
} 