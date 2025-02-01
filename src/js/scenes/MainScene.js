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

        // Game elements
        this.hand = null;
        this.tiles = [];
        this.decks = {};
        this.discardPile = null;

        // Game state
        this.selectedCard = null;
        this.totalPoints = 0;
        this.isPlayerTurn = false;
        this.currentPhase = null;
    }

    init(data) {
        console.log('MainScene init with data:', data);
        if (!data?.socket) {
            console.error('No socket provided to MainScene');
            return;
        }

        this.initializeGameState(data);
        this.socketManager = new SocketManager(this);
        this.socketManager.setupSocketListeners();
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
        }
    }

    create() {
        if (!this.validateGameState()) return;

        this.boardManager = new BoardManager(this);
        this.uiManager = new UIManager(this);

        this.boardManager.createGameBoard();
        this.boardManager.createPlayerArea();
        this.uiManager.createUIElements();
        
        this.updateTurnState();
        console.log('Game scene created successfully');
    }

    validateGameState() {
        if (!this.gameState?.tiles) {
            console.error('No game state available');
            return false;
        }
        return true;
    }

    updateTurnState() {
        this.isPlayerTurn = this.gameState.currentPlayer === this.playerId;
        this.currentPhase = this.gameState.currentPhase;
        
        this.uiManager.updateTurnIndicator();
        this.boardManager.updateDeckInteractions();
    }

    onDeckClick(deck) {
        if (!this.canDrawCard(deck)) return;
        
        this.socket.emit('drawCard', {
            deckType: deck.type,
            roomId: this.roomId
        });
    }

    canDrawCard(deck) {
        if (!this.isPlayerTurn) {
            this.uiManager.showWarning("It's not your turn!");
            return false;
        }

        if (this.currentPhase !== 'draw') {
            this.uiManager.showWarning("You can't draw cards in this phase!");
            return false;
        }

        return true;
    }

    onTileClick(tile, tileIndex) {
        if (!this.selectedCard || !this.isPlayerTurn) return;

        this.socket.emit('playCard', {
            cardType: this.selectedCard.type,
            cardValue: this.selectedCard.value,
            tileIndex: tileIndex,
            roomId: this.roomId
        });
    }

    enableAllInteractions() {
        this.boardManager.enableInteractions();
    }

    disableAllInteractions() {
        this.boardManager.disableInteractions();
    }
} 