export class EventHandler {
    constructor(scene) {
        this.scene = scene;
        this.boardManager = scene.boardManager;
        this.uiManager = scene.uiManager;
        this.gameStateManager = scene.gameStateManager;
    }

    setupGameListeners() {
        this.scene.socket.on('gameUpdate', (data) => {
            this.handleGameUpdate(data);
        });

        this.scene.socket.on('gameEnded', (data) => {
            this.handleGameEnded(data);
        });

        this.scene.socket.on('playerLeft', () => {
            this.handlePlayerLeft();
        });
    }

    handleGameUpdate(data) {
        this.gameStateManager.updateGameState(data.gameState);
        
        switch (data.type) {
            case 'cardDraw':
                this.handleCardDraw(data.data);
                break;
            case 'cardPlay':
                this.handleCardPlay(data.data);
                break;
            case 'turnEnd':
                this.handleTurnEnd(data.data);
                break;
        }

        this.boardManager.updateBoard();
        this.uiManager.updateUI();
    }

    handleCardDraw(data) {
        if (data.playerId === this.gameStateManager.playerId) {
            if (data.deckType === 'assist') {
                this.gameStateManager.hasDrawnAssist = true;
            } else if (data.deckType === 'number') {
                this.gameStateManager.hasDrawnNumber = true;
            }
            
            if (data.drawnCard) {
                this.boardManager.addCardToHand(data.drawnCard);
            }
        }
        
        this.uiManager.updateDeckCounts(data.cardsRemaining);
    }

    handleCardPlay(data) {
        const { playerId, tileIndex, card, score } = data;
        
        this.boardManager.placeCardOnTile(tileIndex, card);
        
        if (score > 0) {
            this.uiManager.showScoreAnimation(playerId, score);
        }
        
        if (playerId === this.gameStateManager.playerId) {
            this.scene.selectedCard = null;
        }
    }

    handleTurnEnd(data) {
        if (this.gameStateManager.playerId === data.nextPlayer) {
            this.gameStateManager.hasDrawnAssist = false;
            this.gameStateManager.hasDrawnNumber = false;
            this.gameStateManager.currentPhase = 'assist_phase';
        }
    }

    handleGameEnded(data) {
        if (data.reason === 'player_left') {
            this.uiManager.showGameEndedMessage('Opponent left the game');
        } else {
            const winner = this.gameStateManager.determineWinner(data.scores);
            this.uiManager.showGameEndedMessage(
                winner === this.gameStateManager.playerId ? 'You won!' : 'You lost!',
                data.scores
            );
        }
    }

    handlePlayerLeft() {
        this.uiManager.showGameEndedMessage('Opponent left the game');
        setTimeout(() => {
            this.scene.scene.start('LobbyScene');
        }, 3000);
    }
} 