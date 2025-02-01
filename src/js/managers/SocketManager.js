export class SocketManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = scene.socket;
    }

    setupSocketListeners() {
        if (!this.socket) {
            console.error('No socket available for SocketManager');
            return;
        }

        // Game state updates
        this.socket.on('gameStateUpdate', this.handleGameStateUpdate.bind(this));
        this.socket.on('turnUpdate', this.handleTurnUpdate.bind(this));
        this.socket.on('cardDrawn', this.handleCardDrawn.bind(this));
        this.socket.on('cardPlayed', this.handleCardPlayed.bind(this));
        this.socket.on('gameError', this.handleGameError.bind(this));
        this.socket.on('playerLeft', this.handlePlayerLeft.bind(this));
    }

    removeListeners() {
        if (!this.socket) return;
        
        this.socket.off('gameStateUpdate');
        this.socket.off('turnUpdate');
        this.socket.off('cardDrawn');
        this.socket.off('cardPlayed');
        this.socket.off('gameError');
        this.socket.off('playerLeft');
    }

    handleGameStateUpdate(gameState) {
        if (!gameState) {
            console.error('Invalid game state received');
            return;
        }

        this.scene.gameState = gameState;
        this.scene.updateTurnState();
        
        // Update board and UI
        if (this.scene.boardManager) {
            this.scene.boardManager.updateBoard(gameState);
        }
        if (this.scene.uiManager) {
            this.scene.uiManager.updateUI(gameState);
        }
    }

    handleTurnUpdate({ currentPlayer, currentPhase }) {
        this.scene.gameState.currentPlayer = currentPlayer;
        this.scene.gameState.currentPhase = currentPhase;
        this.scene.updateTurnState();
    }

    handleCardDrawn({ playerId, card, deckType }) {
        if (playerId === this.scene.playerId) {
            if (this.scene.uiManager) {
                this.scene.uiManager.addCardToHand(card);
            }
        }
        
        if (this.scene.boardManager) {
            this.scene.boardManager.updateDeck(deckType);
        }
    }

    handleCardPlayed({ playerId, card, tileIndex }) {
        if (playerId === this.scene.playerId) {
            if (this.scene.uiManager) {
                this.scene.uiManager.removeCardFromHand(card);
            }
        }
        
        if (this.scene.boardManager) {
            this.scene.boardManager.updateTile(tileIndex, card);
        }
    }

    handleGameError(error) {
        console.error('Game error:', error);
        if (this.scene.uiManager) {
            this.scene.uiManager.showError(error);
        }
    }

    handlePlayerLeft() {
        if (this.scene.uiManager) {
            this.scene.uiManager.showError('Other player left the game');
        }
        
        // Disable all interactions
        this.scene.disableAllInteractions();
        
        // Return to lobby after a delay
        this.scene.time.delayedCall(3000, () => {
            this.scene.scene.start('LobbyScene');
        });
    }

    // Methods for sending events to the server
    drawCard(deckType) {
        this.socket.emit('drawCard', {
            deckType,
            roomId: this.scene.roomId
        });
    }

    playCard(card, tileIndex) {
        this.socket.emit('playCard', {
            cardType: card.type,
            cardValue: card.value,
            tileIndex,
            roomId: this.scene.roomId
        });
    }
} 