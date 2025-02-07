import { SocketManager } from '../managers/SocketManager.js';
import { BoardManager } from '../managers/BoardManager.js';
import { UIManager } from '../managers/UIManager.js';
import { GameStateManager } from '../managers/GameStateManager.js';
import { EventHandler } from '../managers/EventHandler.js';
import { TurnManager } from '../managers/TurnManager.js';
import socketService from '../services/SocketService.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    init(data) {
        console.log('MainScene init with data:', data);
        
        // Validate required game data
        if (!data?.socket || !data?.roomCode || !data?.players) {
            console.error('Missing required game data');
            this.scene.start('LobbyScene');
            return;
        }

        this.socket = data.socket;
        this.roomCode = data.roomCode;
        this.players = data.players;
        this.currentTurn = data.currentTurn;

        // Initialize managers
        this.gameStateManager = new GameStateManager(this);
        this.socketManager = new SocketManager(this);
        this.eventHandler = new EventHandler(this);

        // Setup scene cleanup
        this.events.once('shutdown', () => {
            console.log('MainScene shutting down');
            if (this.socketManager) {
                this.socketManager.removeListeners();
            }
        });

        // Verify socket connection
        if (!this.socket.connected) {
            console.warn('Socket not connected in MainScene init');
            this.scene.start('LobbyScene');
            return;
        }

        // Initialize game state
        if (!this.gameStateManager.initializeGameState(data)) {
            console.error('Failed to initialize game state');
            this.scene.start('LobbyScene');
            return;
        }
    }

    create() {
        // Remove any existing DOM elements from the lobby
        const existingInput = document.querySelector('input');
        if (existingInput) existingInput.remove();
        const existingButtons = document.querySelectorAll('button');
        existingButtons.forEach(button => button.remove());

        // Create game elements in order
        this.boardManager = new BoardManager(this);
        
        // Ensure game state is accessible to board manager
        this.gameState = this.gameStateManager.gameState;
        
        this.uiManager = new UIManager(this);
        this.turnManager = new TurnManager(this);

        // Create the game board first
        this.boardManager.createGameBoard();
        
        // Create UI elements after board is set up
        this.uiManager.createUIElements();
        
        this.eventHandler.setupGameListeners();
        console.log('Game scene created successfully');

        // Emit ready event to server
        this.socket.emit('gameSceneReady', this.roomCode);
    }

    // Delegate all interactions to TurnManager
    onCardSelect(card) {
        this.turnManager.onCardSelect(card);
    }

    onTileClick(tile, tileIndex) {
        this.turnManager.onTileClick(tile, tileIndex);
    }

    onEndTurnClick() {
        this.turnManager.onEndTurnClick();
    }

    onExitClick() {
        this.turnManager.onExitClick();
    }
} 