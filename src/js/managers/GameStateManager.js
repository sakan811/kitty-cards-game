import socketService from '../services/SocketService.js';

export class GameStateManager {
    constructor(scene) {
        this.scene = scene;
        this.playerId = null;
        this.opponentId = null;
        this.roomId = null;
        this.gameState = null;
        this.isPlayerTurn = false;
        this.currentPhase = 'assist_phase';
        this.hasDrawnAssist = false;
        this.hasDrawnNumber = false;
    }

    initializeGameState(data) {
        this.socket = data.socket;
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        
        if (this.roomId) {
            socketService.setRoom(this.roomId);
        }
        
        if (data.players && Array.isArray(data.players)) {
            const otherPlayer = data.players.find(p => p && p.id && p.id !== this.playerId);
            this.opponentId = otherPlayer?.id || null;
        }

        // Create default game state if none provided
        if (!data.gameState) {
            data.gameState = {
                currentPlayer: this.playerId,
                turnState: 'assist_phase',
                players: {
                    [this.playerId]: {
                        hasDrawnAssist: false,
                        hasDrawnNumber: false,
                        score: 0
                    }
                },
                tiles: {
                    tiles: Array(9).fill(null).map(() => ({
                        card: null,
                        number: null,
                        isHighlighted: false
                    }))
                }
            };
            if (this.opponentId) {
                data.gameState.players[this.opponentId] = {
                    hasDrawnAssist: false,
                    hasDrawnNumber: false,
                    score: 0
                };
            }
        }

        console.log('Initializing game state:', data.gameState);
        this.gameState = data.gameState;
        this.isPlayerTurn = this.gameState.currentPlayer === this.playerId;
        this.currentPhase = this.gameState.turnState || 'assist_phase';
        
        if (this.gameState.players && this.playerId) {
            const playerState = this.gameState.players[this.playerId] || {};
            this.hasDrawnAssist = playerState.hasDrawnAssist || false;
            this.hasDrawnNumber = playerState.hasDrawnNumber || false;
        }
        return true;
    }

    updateGameState(newState) {
        this.gameState = newState;
        this.updateTurnState();
    }

    updateTurnState() {
        const prevTurn = this.isPlayerTurn;
        const prevPhase = this.currentPhase;

        this.isPlayerTurn = this.gameState.currentPlayer === this.playerId;
        this.currentPhase = this.gameState.turnState || this.currentPhase;
        
        return {
            isPlayerTurn: this.isPlayerTurn,
            currentPhase: this.currentPhase,
            changed: prevTurn !== this.isPlayerTurn || prevPhase !== this.currentPhase
        };
    }

    validateGameState() {
        return !!this.gameState;
    }

    determineWinner(scores) {
        const entries = Object.entries(scores);
        if (entries.length !== 2) return null;
        return entries[0][1] > entries[1][1] ? entries[0][0] : entries[1][0];
    }
} 