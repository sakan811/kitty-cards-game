export class SocketManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = scene.socket;
    }

    setupSocketListeners() {
        if (!this.socket) {
            console.error('Cannot setup listeners: Socket not initialized');
            return;
        }

        this.setupGameEventListeners();
        this.setupTurnEventListeners();
        this.setupErrorEventListeners();
    }

    setupGameEventListeners() {
        this.socket.on('gameUpdate', ({ action, data, gameState }) => {
            console.log('Game Update:', action, data);
            
            if (action === 'cardDraw' && data.playerId === this.scene.playerId) {
                this.handleCardDraw(data);
            }
            
            if (gameState) {
                this.renderGameState(gameState);
            }
        });

        this.socket.on('playerLeft', ({ roomId }) => {
            if (roomId === this.scene.roomId) {
                this.scene.uiManager.showGameOver('Opponent left the game');
            }
        });
    }

    setupTurnEventListeners() {
        this.socket.on('turnUpdate', ({ currentPlayer, turnPhase }) => {
            console.log('Turn Update:', { currentPlayer, turnPhase });
            this.updateGameTurn(currentPlayer, turnPhase);
        });
    }

    setupErrorEventListeners() {
        this.socket.on('gameError', (error) => {
            console.error('Game Error:', error);
            this.scene.uiManager.showErrorMessage(error);
        });
    }

    handleCardDraw(data) {
        const { cardType, cardValue } = data;
        // Handle card draw animation or UI update
        this.scene.hand.addCard(cardType, cardValue);
    }

    renderGameState(gameState) {
        if (!gameState) {
            console.error('Invalid game state received');
            return;
        }

        console.log('Rendering game state:', gameState);

        if (gameState.tiles) this.renderTiles(gameState.tiles);
        if (gameState.hands?.[this.scene.playerId]) this.renderPlayerHand(gameState.hands[this.scene.playerId]);
        if (gameState.scores) this.renderScores(gameState.scores);
        if (gameState.currentPlayer) {
            this.scene.isPlayerTurn = gameState.currentPlayer === this.scene.playerId;
            this.scene.updateTurnState();
        }
    }

    renderTiles(tiles) {
        if (!Array.isArray(tiles)) {
            console.error('Invalid tiles data:', tiles);
            return;
        }

        tiles.forEach((tileData, index) => {
            const tile = this.scene.tiles[index];
            if (tile?.render) {
                tile.render(tileData);
            }
        });
    }

    renderPlayerHand(handData) {
        if (!handData || !this.scene.hand) {
            console.warn('Cannot render hand: missing data or hand not initialized');
            return;
        }

        const cards = handData.map(card => ({
            type: card.type,
            value: card.value
        }));

        this.scene.hand.render(cards);
    }

    renderScores(scores) {
        if (this.scene.uiManager.pointsText) {
            this.scene.uiManager.updateScore(scores[this.scene.playerId] || 0);
        }
    }

    updateGameTurn(currentPlayer, turnPhase) {
        this.scene.currentPhase = turnPhase;
        this.scene.isPlayerTurn = currentPlayer === this.scene.playerId;
        this.scene.updateTurnState();
    }
} 