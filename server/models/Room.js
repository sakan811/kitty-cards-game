import { GAME_CONFIG } from '../config/gameConfig.js';

export class Room {
    constructor(id, hostId) {
        this.id = id;
        this.hostId = hostId;
        this.players = [{ id: hostId, ready: false }];
        this.gameStarted = false;
    }

    addPlayer(playerId) {
        if (this.players.length >= 2) {
            throw new Error('Room is full');
        }
        if (!this.players.some(p => p.id === playerId)) {
            this.players.push({ id: playerId, ready: false });
        }
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (playerId === this.hostId && this.players.length > 0) {
            this.hostId = this.players[0].id;
        }
    }

    setPlayerReady(playerId, readyState = true) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.ready = readyState;
            console.log(`Player ${playerId} ready state set to ${readyState}`);
        } else {
            console.error(`Player ${playerId} not found in room`);
            throw new Error('Player not found in room');
        }
    }

    areAllPlayersReady() {
        return this.players.length === 2 && this.players.every(p => p.ready);
    }

    startGame() {
        this.gameStarted = true;
    }

    getPlayerIds() {
        return this.players.map(p => p.id);
    }
} 