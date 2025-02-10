import socketService from '../services/SocketService.js';
import { LobbyUI } from '../ui/LobbyUI.js';

export class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.roomId = null;
        this.ui = null;
    }

    init() {
        this.currentRoomId = null;
        this.playerId = null;
        this.players = [];
        
        // Initialize socket connection
        this.socket = socketService.connect();
        this.setupSocketListeners();

        this.events.once('shutdown', this.cleanup, this);
    }

    create() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const width = this.cameras.main.width;

        // Create main container for better organization
        this.mainContainer = this.add.container(0, 0);

        // Title with better styling
        const titleText = this.add.text(centerX, 80, 'Kitty Cards Game', {
            fontSize: '48px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#4a4a4a',
            strokeThickness: 6,
            shadow: { blur: 4, color: '#000000', fill: true }
        }).setOrigin(0.5);

        const subtitleText = this.add.text(centerX, 140, 'Lobby', {
            fontSize: '32px',
            fontFamily: 'Arial',
            fill: '#cccccc'
        }).setOrigin(0.5);

        // Initial Menu Container
        this.initialMenuContainer = this.add.container(centerX, centerY);
        
        // Create Room Button
        const createButton = this.add.dom(0, -40, 'button', 'class: phaser-button phaser-button-success', 'Create Room')
            .setOrigin(0.5)
            .addListener('click', () => this.handleCreateRoom());

        // Join Room Section
        const joinContainer = this.add.container(0, 40);
        
        // Room Code Input
        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.placeholder = 'Enter Room Code';
        codeInput.style.width = '200px';
        codeInput.style.height = '40px';
        codeInput.style.textAlign = 'center';
        codeInput.style.fontSize = '18px';
        codeInput.style.marginBottom = '10px';
        codeInput.style.borderRadius = '5px';
        codeInput.style.border = '2px solid #4CAF50';

        const inputElement = this.add.dom(0, -20, codeInput);
        
        // Join Button
        const joinButton = this.add.dom(0, 30, 'button', 'class: phaser-button phaser-button-primary', 'Join Room')
            .setOrigin(0.5)
            .addListener('click', () => {
                const code = codeInput.value.trim();
                if (code) {
                    this.handleJoinRoom(code);
                } else {
                    this.showError('Please enter a room code');
                }
            });

        joinContainer.add([inputElement, joinButton]);
        this.initialMenuContainer.add([createButton, joinContainer]);

        // Room Info Container (hidden initially)
        this.roomInfoContainer = this.add.container(centerX, centerY);
        this.roomInfoContainer.setAlpha(0);
        this.roomInfoContainer.setVisible(false);

        // Ready Button
        this.readyButton = this.add.dom(0, 20, 'button', 'class: phaser-button phaser-button-success', 'Ready')
            .setOrigin(0.5)
            .addListener('click', () => this.handleReady());

        // Player List Container
        this.playerListContainer = this.add.container(0, 80);
        
        this.roomInfoContainer.add([
            this.readyButton,
            this.playerListContainer
        ]);

        // Add all containers to main container
        this.mainContainer.add([
            titleText,
            subtitleText,
            this.initialMenuContainer,
            this.roomInfoContainer
        ]);
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
        socketService.on('playerJoined', this.handlePlayerJoined.bind(this));
        socketService.on('roomError', this.handleRoomError.bind(this));
        socketService.on('playerReady', this.handlePlayerReady.bind(this));
        socketService.on('gameStart', this.handleGameStart.bind(this));
        socketService.on('playerLeft', this.handlePlayerLeft.bind(this));
        socketService.on('connect_error', this.handleConnectionError.bind(this));
        socketService.on('joinedRoom', this.handleJoinedRoom.bind(this));
    }

    // Event Handlers
    handleCreateRoom() {
        socketService.emit('createRoom');
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
        this.showWaitingRoom(roomId, this.players, playerId);
    }

    handlePlayerJoined({ roomId, room }) {
        if (this.currentRoomId === roomId) {
            this.players = room.players;
            this.updatePlayerList(room.players, this.playerId);
        }
    }

    handlePlayerReady({ roomId, room }) {
        if (this.currentRoomId === roomId) {
            this.players = room.players;
            this.updatePlayerList(room.players, this.playerId);
        }
    }

    handleGameStart({ roomId, gameState }) {
        if (!roomId || !gameState) {
            console.error('Invalid data received for gameStart event:', { roomId, gameState });
            return;
        }

        if (this.currentRoomId === roomId) {
            // Remove any existing DOM elements before transitioning
            const existingInput = document.querySelector('input');
            if (existingInput) existingInput.remove();
            const existingButtons = document.querySelectorAll('button');
            existingButtons.forEach(button => button.remove());

            // Show transition message
            this.showMessage('Starting game...');

            // Start GameScene with all necessary data
            this.scene.start('GameScene', { 
                socket: socketService.getSocket(),
                roomCode: this.currentRoomId, // Match GameScene's expected property
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
                this.updatePlayerList(room.players, this.playerId);
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

    handleJoinRoom(roomId) {
        if (!roomId) {
            this.showError('Please enter a room code');
            return;
        }
        console.log('Attempting to join room:', roomId);
        socketService.emit('joinRoom', { roomId: roomId });
    }

    handleJoinedRoom({ roomId, playerId, room }) {
        if (!roomId || !playerId || !room) {
            console.error('Invalid join room data:', { roomId, playerId, room });
            this.showError('Invalid room data received');
            return;
        }

        console.log('Successfully joined room:', roomId, 'Player ID:', playerId);
        this.currentRoomId = roomId;
        this.playerId = playerId;
        this.players = room.players;
        this.showWaitingRoom(roomId, room.players, playerId);
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

    showWaitingRoom(roomId, players, playerId) {
        // Hide initial menu with fade out
        this.tweens.add({
            targets: this.initialMenuContainer,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this.initialMenuContainer.setVisible(false);
                
                // Update room info
                this.currentRoomId = roomId;
                this.playerId = playerId;
                
                // Show room info with fade in
                this.roomInfoContainer.setVisible(true);
                this.tweens.add({
                    targets: this.roomInfoContainer,
                    alpha: 1,
                    duration: 300
                });
                
                // Update player list
                this.updatePlayerList(players, playerId);
            }
        });
    }

    updatePlayerList(players, currentPlayerId) {
        // Clear existing player list
        this.playerListContainer.removeAll();

        // Add player list title
        const title = this.add.text(0, -50, 'Players', {
            fontSize: '28px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#4a4a4a',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.playerListContainer.add(title);

        // Add player entries with better styling
        players.forEach((player, index) => {
            const isCurrentPlayer = player.id === currentPlayerId;
            const playerContainer = this.add.container(0, index * 50);

            // Player background
            const bg = this.add.graphics();
            bg.fillStyle(player.ready ? 0x4CAF50 : 0x333333, 0.3);
            bg.fillRoundedRect(-100, -15, 200, 40, 8);
            
            const playerText = this.add.text(0, 0, 
                `${isCurrentPlayer ? 'You' : 'Player 2'}`, {
                fontSize: '22px',
                fontFamily: 'Arial',
                fill: player.ready ? '#4CAF50' : '#ffffff'
            }).setOrigin(0.5);

            // Ready status with icon
            if (player.ready) {
                const readyIcon = this.add.text(70, 0, '✓', {
                    fontSize: '22px',
                    fontFamily: 'Arial',
                    fill: '#4CAF50'
                }).setOrigin(0.5);
                playerContainer.add(readyIcon);
            }

            playerContainer.add([bg, playerText]);
            this.playerListContainer.add(playerContainer);
        });
    }
} 