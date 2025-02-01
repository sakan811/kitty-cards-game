import socketService from '../services/SocketService.js';
import { LobbyUI } from '../ui/LobbyUI.js';

export class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.ui = null;
        this.currentRoomId = null;
        this.playerId = null;
        this.players = [];
    }

    init() {
        this.currentRoomId = null;
        this.playerId = null;
        this.players = [];
        
        socketService.connect();
        this.setupSocketListeners();

        this.events.once('shutdown', this.cleanup, this);
    }

    create() {
        this.ui = new LobbyUI(this);
        this.ui.createMainMenu();
    }

    cleanup() {
        socketService.disconnect();
        this.players = [];
        this.currentRoomId = null;
        this.playerId = null;
    }

    setupSocketListeners() {
        socketService.removeAllListeners();

        socketService.on('roomCreated', this.handleRoomCreated.bind(this));
        socketService.on('joinedRoom', this.handleJoinedRoom.bind(this));
        socketService.on('playerJoined', this.handlePlayerJoined.bind(this));
        socketService.on('roomError', this.handleRoomError.bind(this));
        socketService.on('playerReady', this.handlePlayerReady.bind(this));
        socketService.on('gameStart', this.handleGameStart.bind(this));
        socketService.on('playerLeft', this.handlePlayerLeft.bind(this));
        socketService.on('connect_error', this.handleConnectionError.bind(this));
    }

    // Event Handlers
    handleCreateRoom() {
        socketService.emit('createRoom');
    }

    handleJoinRoom(roomId) {
        socketService.emit('joinRoom', roomId);
    }

    handleReady() {
        socketService.emit('playerReady', this.currentRoomId);
    }

    handleRoomCreated({ roomId, playerId }) {
        if (!roomId || !playerId) {
            console.error('Invalid room creation data:', { roomId, playerId });
            this.showError('Invalid room data received');
            return;
        }

        console.log('Room created:', roomId, 'Player ID:', playerId);
        this.currentRoomId = roomId;
        this.playerId = playerId;
        this.players = [{ id: playerId, ready: false }];
        this.ui.showWaitingRoom(roomId, this.players, playerId);
        this.ui.showCopyableCode(roomId);
    }

    handleJoinedRoom({ roomId, playerId, room }) {
        if (!roomId || !playerId || !room || !room.players) {
            console.error('Invalid room join data:', { roomId, playerId, room });
            this.showError('Invalid room data received');
            return;
        }

        console.log('Joined room:', roomId, 'as player:', playerId);
        this.currentRoomId = roomId;
        this.playerId = playerId;
        this.players = room.players;
        this.ui.showWaitingRoom(roomId, room.players, playerId);
    }

    handlePlayerJoined({ roomId, room }) {
        if (!roomId || !room || !room.players) {
            console.error('Invalid player joined data:', { roomId, room });
            this.showError('Invalid room data received');
            return;
        }

        if (this.currentRoomId === roomId) {
            this.players = room.players;
            this.ui.updatePlayerStatus(room.players, this.playerId);
        }
    }

    handlePlayerReady({ roomId, room }) {
        if (!roomId || !room || !room.players) {
            console.error('Invalid data received for playerReady event:', { roomId, room });
            return;
        }

        if (this.currentRoomId === roomId) {
            this.players = room.players;
            this.ui.updatePlayerStatus(room.players, this.playerId);
        }
    }

    handleGameStart({ roomId, gameState }) {
        if (!roomId || !gameState) {
            console.error('Invalid data received for gameStart event:', { roomId, gameState });
            return;
        }

        if (this.currentRoomId === roomId) {
            this.scene.start('MainScene', { 
                socket: socketService.getSocket(),
                roomId: this.currentRoomId,
                playerId: this.playerId,
                players: this.players,
                gameState,
                currentTurn: gameState.currentPlayer
            });
        }
    }

    handlePlayerLeft({ roomId, room }) {
        if (this.currentRoomId === roomId) {
            if (room && room.players) {
                this.players = room.players;
                this.ui.updatePlayerStatus(room.players, this.playerId);
            } else {
                this.showError('Other player left the game');
                this.time.delayedCall(3000, () => {
                    window.location.reload();
                });
            }
        }
    }

    handleRoomError(error) {
        console.error('Room error:', error);
        this.showError(error);
    }

    handleConnectionError(error) {
        console.error('Socket connection error:', error);
        this.showError('Connection error. Please try again.');
    }

    // UI Helpers
    showError(error) {
        const errorText = this.add.text(400, 500, error, {
            fontSize: '18px',
            color: '#ff0000'
        }).setOrigin(0.5);

        this.time.delayedCall(3000, () => {
            errorText.destroy();
        });
    }

    showMessage(message) {
        const messageText = this.add.text(400, 350, message, {
            fontSize: '18px',
            color: '#4CAF50',
            backgroundColor: '#ffffff',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5);

        this.time.delayedCall(2000, () => {
            messageText.destroy();
        });
    }
} 