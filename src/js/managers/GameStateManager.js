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
        if (!data?.socket || !data?.roomCode || !data?.players || !data?.gameState) {
            console.error('Missing required game data:', data);
            return false;
        }

        this.socket = data.socket;
        this.roomId = data.roomCode;
        this.playerId = this.socket.id;
        
        // Set opponent ID
        if (data.players && Array.isArray(data.players)) {
            this.opponentId = data.players.find(p => p !== this.playerId);
        }

        console.log('Initializing game state:', data.gameState);
        this.gameState = data.gameState;
        
        // Set turn state
        this.isPlayerTurn = this.gameState.currentPlayer === this.playerId;
        this.currentPhase = this.gameState.turnState;
        
        // Set player state
        if (this.gameState.players && this.playerId) {
            const playerState = this.gameState.players[this.playerId];
            if (playerState) {
                this.hasDrawnAssist = playerState.hasDrawnAssist;
                this.hasDrawnNumber = playerState.hasDrawnNumber;
            }
        }

        return true;
    }

    updateGameState(newState) {
        if (!newState) return false;
        
        this.gameState = newState;
        
        // Update turn state
        this.isPlayerTurn = newState.currentPlayer === this.playerId;
        this.currentPhase = newState.turnState;
        
        // Update player state
        if (newState.players && this.playerId) {
            const playerState = newState.players[this.playerId];
            if (playerState) {
                this.hasDrawnAssist = playerState.hasDrawnAssist;
                this.hasDrawnNumber = playerState.hasDrawnNumber;
            }
        }

        return true;
    }

    validateGameState() {
        return this.gameState && 
               this.gameState.tiles && 
               Array.isArray(this.gameState.tiles.tiles) &&
               this.gameState.tiles.tiles.length === 9;
    }

    determineWinner(scores) {
        if (!scores) return null;
        const entries = Object.entries(scores);
        if (entries.length !== 2) return null;
        return entries[0][1] > entries[1][1] ? entries[0][0] : entries[1][0];
    }
} 