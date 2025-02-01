import { SocketManager } from '../managers/SocketManager.js';
import { BoardManager } from '../managers/BoardManager.js';
import { UIManager } from '../managers/UIManager.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.initializeProperties();
    }

    initializeProperties() {
        // Core game properties
        this.playerId = null;
        this.opponentId = null;
        this.roomId = null;
        this.socket = null;
        this.gameState = null;

        // Managers
        this.socketManager = null;
        this.boardManager = null;
        this.uiManager = null;

        // Game state
        this.selectedCard = null;
        this.isPlayerTurn = false;
        this.currentPhase = null;
    }

    init(data) {
        console.log('MainScene init with data:', data);
        if (!data?.socket) {
            console.error('No socket provided to MainScene');
            this.scene.start('LobbyScene');
            return;
        }

        this.initializeGameState(data);
        this.socketManager = new SocketManager(this);
        this.socketManager.setupSocketListeners();

        this.events.once('shutdown', () => {
            if (this.socketManager) {
                this.socketManager.removeListeners();
            }
        });
    }

    initializeGameState(data) {
        this.socket = data.socket;
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        
        if (data.players) {
            this.opponentId = data.players.find(p => p.id !== this.playerId)?.id;
        }

        if (data.gameState) {
            this.gameState = data.gameState;
            this.isPlayerTurn = data.gameState.currentPlayer === this.playerId;
            this.currentPhase = data.gameState.currentPhase;
        } else {
            console.error('No game state provided');
            this.scene.start('LobbyScene');
        }
    }

    create() {
        if (!this.validateGameState()) {
            this.scene.start('LobbyScene');
            return;
        }

        this.boardManager = new BoardManager(this);
        this.uiManager = new UIManager(this);

        this.boardManager.createGameBoard();
        this.boardManager.createPlayerArea();
        this.uiManager.createUIElements();
        
        this.updateTurnState();
        console.log('Game scene created successfully');
    }

    validateGameState() {
        if (!this.gameState) {
            console.error('No game state available');
            return false;
        }
        return true;
    }

    updateTurnState() {
        this.isPlayerTurn = this.gameState.currentPlayer === this.playerId;
        this.currentPhase = this.gameState.currentPhase;
        
        if (this.uiManager) {
            this.uiManager.updateTurnIndicator();
        }
        if (this.boardManager) {
            this.boardManager.updateDeckInteractions();
        }
    }

    onDeckClick(deck) {
        if (!this.canDrawCard(deck)) return;
        this.socketManager.drawCard(deck.type);
    }

    canDrawCard(deck) {
        if (!this.isPlayerTurn) {
            this.uiManager?.showWarning("It's not your turn!");
            return false;
        }

        if (this.currentPhase !== 'draw') {
            this.uiManager?.showWarning("You can't draw cards in this phase!");
            return false;
        }

        return true;
    }

    onTileClick(tile, tileIndex) {
        if (!this.selectedCard || !this.isPlayerTurn) return;
        this.socketManager.playCard(this.selectedCard, tileIndex);
    }

    enableAllInteractions() {
        this.boardManager?.enableInteractions();
    }

    disableAllInteractions() {
        this.boardManager?.disableInteractions();
    }
} 