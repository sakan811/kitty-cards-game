export class SocketManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = scene.socket;
        console.log('SocketManager initialized with room:', this.socket);
        
        if (this.socket) {
            this.setupSocketListeners();
        } else {
            console.warn('No socket provided to SocketManager');
        }
    }

    setupSocketListeners() {
        console.log('Setting up Colyseus room listeners');
        
        // Handle room state changes
        this.socket.onStateChange((state) => {
            console.log('Room state changed:', state);
            this.scene.handleGameUpdate({
                type: 'gameState',
                gameState: state
            });
        });

        // Handle room errors
        this.socket.onError((code, message) => {
            console.error('Room error:', code, message);
            if (this.scene.uiManager) {
                this.scene.uiManager.showErrorMessage(`Error: ${message}`);
            }
        });

        // Handle room leave
        this.socket.onLeave((code) => {
            console.log('Left room:', code);
            if (this.scene.uiManager) {
                this.scene.uiManager.showErrorMessage('Disconnected from game');
            }
            // Optionally trigger a scene restart or game over
            this.scene.events.emit('gameError', 'Connection lost');
        });
    }

    removeListeners() {
        if (this.socket) {
            this.socket.removeAllListeners();
        }
    }

    // Game action methods
    drawCard() {
        if (!this.isConnected()) return;
        this.socket.send('drawCard');
    }

    playCard(cardIndex, tileIndex) {
        if (!this.isConnected()) return;
        this.socket.send('playCard', { cardIndex, tileIndex });
    }

    endTurn() {
        if (!this.isConnected()) return;
        this.socket.send('endTurn');
    }

    exitRoom() {
        if (this.socket) {
            this.socket.leave();
        }
    }

    isConnected() {
        return this.socket && this.socket.hasJoined;
    }
} 