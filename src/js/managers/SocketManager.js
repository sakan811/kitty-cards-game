export class SocketManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = scene.socket;
        console.log('SocketManager initialized, socket connected:', this.socket?.connected);
        
        if (this.socket) {
            this.setupSocketListeners();
        }
    }

    setupSocketListeners() {
        console.log('Setting up socket listeners');
        
        this.socket.on('gameUpdate', (data) => {
            this.scene.handleGameUpdate(data);
        });

        this.socket.on('gameError', (error) => {
            console.log('Game error:', error);
            this.scene.uiManager?.showMessage(error);
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Attempting to reconnect...', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Socket reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Socket reconnection failed');
            this.scene.uiManager?.showErrorMessage('Connection lost. Please refresh the page.');
        });

        this.socket.on('gameAction', (response) => {
            console.log('Game action response received:', response);
            if (response.action === 'drawCard') {
                try {
                    this.handleCardDraw(response.data);
                } catch (error) {
                    console.error('Error handling card draw response:', error);
                }
            }
        });

        this.socket.on('playerLeft', () => {
            console.log('Player left the game');
            this.handlePlayerLeft();
        });
    }

    drawCard(deckType) {
        console.log('Sending drawCard request:', deckType);
        if (!this.socket?.connected) {
            this.scene.uiManager?.showMessage('Not connected to server');
            return;
        }

        console.log('Emitting draw card:', { deckType });
        this.socket.emit('gameAction', {
            roomId: this.scene.roomId,
            action: 'drawCard',
            data: { deckType }
        });
    }

    playCard(card, tileIndex) {
        if (!this.socket?.connected) {
            this.scene.uiManager?.showMessage('Not connected to server');
            return;
        }

        this.socket.emit('gameAction', {
            roomId: this.scene.roomId,
            action: 'playCard',
            data: { cardIndex: this.scene.boardManager.playerHand.indexOf(card), tileIndex }
        });
    }

    endTurn() {
        if (!this.socket?.connected) {
            this.scene.uiManager?.showMessage('Not connected to server');
            return;
        }

        this.socket.emit('gameAction', {
            roomId: this.scene.roomId,
            action: 'endTurn'
        });
    }

    exitRoom() {
        if (!this.socket?.connected) {
            this.scene.uiManager?.showMessage('Not connected to server');
            return;
        }

        this.socket.emit('exitRoom', this.scene.roomId);
    }

    removeListeners() {
        console.log('Removing socket listeners');
        if (this.socket) {
            this.socket.removeAllListeners();
        }
    }

    processPendingActions() {
        while (this.pendingActions.length > 0) {
            const action = this.pendingActions.shift();
            this.processAction(action);
        }
    }

    processAction(action) {
        switch (action.type) {
            case 'drawCard':
                this.emitDrawCard(action.data);
                break;
            case 'playCard':
                this.emitPlayCard(action.data);
                break;
        }
    }

    queueAction(type, data) {
        this.pendingActions.push({ type, data });
    }

    emitDrawCard(data) {
        console.log('Emitting draw card:', data);
        this.socket.emit('gameAction', {
            roomId: this.scene.roomId,
            action: 'drawCard',
            data
        }, (response) => {
            console.log('Draw card request acknowledged:', response);
            if (response?.error) {
                console.error('Draw card request failed:', response.error);
                this.scene.uiManager?.showErrorMessage(response.error);
            }
        });
    }

    async handleCardDraw(data) {
        console.log('Handling card draw:', data);
        const { playerId, deckType, cardsRemaining, drawnCard } = data;

        // Only handle cards for this player
        if (playerId === this.scene.playerId && drawnCard) {
            console.log('Processing drawn card for player:', playerId);
            const deck = this.scene.decks?.[deckType];
            
            if (!deck) {
                console.error('Deck not found for type:', deckType);
                return;
            }

            try {
                // Wait for the card animation to complete
                await deck.animateCardToHand(drawnCard);
                console.log('Card animation completed successfully');
            } catch (error) {
                console.error('Failed to animate card:', error);
                // Attempt to add card directly to hand if animation fails
                if (this.scene.hand) {
                    const card = new Card(
                        this.scene,
                        this.scene.hand.x,
                        this.scene.hand.y,
                        drawnCard.type || deckType,
                        drawnCard.value
                    );
                    await this.scene.hand.addCard(card);
                }
            }
        } else {
            console.log('Card draw not for this player or no card data');
        }

        // Update deck count if needed
        if (this.scene.decks?.[deckType]) {
            console.log('Updating deck count:', cardsRemaining);
            this.scene.decks[deckType].updateCardCount?.(cardsRemaining);
        }
    }

    handleCardPlay(data) {
        console.log('Handling card play:', data);
        const { playerId, tileIndex, cardValue } = data;

        // Update tile
        if (this.scene.tiles?.[tileIndex]) {
            this.scene.tiles[tileIndex].updateValue(cardValue);
        }

        // Remove card from hand if it's this player's card
        if (playerId === this.scene.playerId) {
            this.scene.hand?.removeSelectedCard();
        }
    }

    handlePlayerLeft() {
        this.scene.uiManager?.showErrorMessage('Other player left the game');
        this.scene.disableAllInteractions();
        
        this.scene.time.delayedCall(3000, () => {
            this.scene.scene.start('LobbyScene');
        });
    }
} 