import { GAME_CONFIG } from '../config/gameConfig.js';

export class Room {
    constructor(id, hostId) {
        this.id = id;
        this.hostId = hostId;
        this.players = [{
            id: hostId,
            ready: false
        }];
        this.status = 'waiting';
    }

    addPlayer(playerId) {
        if (this.players.length >= GAME_CONFIG.maxPlayers) {
            throw new Error('Room is full');
        }
        if (this.status !== 'waiting') {
            throw new Error('Game already in progress');
        }
        this.players.push({
            id: playerId,
            ready: false
        });
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.players.length === 0) {
            this.status = 'closed';
        } else if (playerId === this.hostId && this.players.length > 0) {
            this.hostId = this.players[0].id;
        }
    }

    setPlayerReady(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.ready = true;
        }
    }

    areAllPlayersReady() {
        return this.players.length === GAME_CONFIG.minPlayers && 
               this.players.every(p => p.ready);
    }

    startGame() {
        if (!this.areAllPlayersReady()) {
            throw new Error('Not all players are ready');
        }
        this.status = 'playing';
    }

    getPlayerIds() {
        return this.players.map(p => p.id);
    }
} 