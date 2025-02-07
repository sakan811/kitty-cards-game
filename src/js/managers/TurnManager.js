export class TurnManager {
    constructor(scene) {
        this.scene = scene;
        this.boardManager = scene.boardManager;
        this.uiManager = scene.uiManager;
        this.gameStateManager = scene.gameStateManager;
        this.selectedCard = null;
    }

    onCardSelect(card) {
        if (!this.gameStateManager.isPlayerTurn) return;
        
        if (this.gameStateManager.currentPhase === 'number_phase' && card.type === 'number') {
            this.selectedCard = card;
            this.boardManager.highlightValidTiles(card);
        } else if (this.gameStateManager.currentPhase === 'assist_phase' && card.type === 'assist') {
            this.selectedCard = card;
            // Handle assist card effects
            this.boardManager.handleAssistCardEffect(card);
        }
    }

    onTileClick(tile, tileIndex) {
        if (!this.gameStateManager.isPlayerTurn || !this.selectedCard) return;
        
        if (this.boardManager.isValidMove(tile, this.selectedCard)) {
            this.scene.socket.emit('playCard', {
                card: this.selectedCard,
                tileIndex: tileIndex,
                roomId: this.gameStateManager.roomId
            });
        }
    }

    onEndTurnClick() {
        if (!this.gameStateManager.isPlayerTurn) return;
        
        this.scene.socket.emit('endTurn', {
            roomId: this.gameStateManager.roomId
        });
        
        this.selectedCard = null;
        this.boardManager.clearHighlights();
    }

    onExitClick() {
        this.scene.socket.emit('leaveRoom', {
            roomId: this.gameStateManager.roomId
        });
        this.scene.scene.start('LobbyScene');
    }

    enableAllInteractions() {
        this.boardManager.enableInteractions();
        this.uiManager.enableButtons();
    }

    disableAllInteractions() {
        this.boardManager.disableInteractions();
        this.uiManager.disableButtons();
    }
} 