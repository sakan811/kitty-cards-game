export class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.roomInput = null;
        this.mainContainer = null;
        this.waitingContainer = null;
        this.currentRoomId = null;
        this.playerId = null;
        this.readyButton = null;
        this.statusText = null;
    }

    init() {
        // Connect to Socket.IO server using the global io object
        this.socket = io('http://localhost:3000');
        this.setupSocketListeners();
    }

    create() {
        // Create main container for lobby elements
        this.mainContainer = this.add.container(0, 0);
        this.waitingContainer = this.add.container(0, 0);
        this.waitingContainer.setVisible(false);

        // Add background
        const bg = this.add.rectangle(0, 0, 800, 600, 0xf0f0f0).setOrigin(0);
        this.mainContainer.add(bg);

        // Title
        const title = this.add.text(400, 100, 'Kitty Cards Game Lobby', {
            fontSize: '32px',
            color: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.mainContainer.add(title);

        // Create Room button
        const createButton = this.add.rectangle(400, 250, 200, 50, 0x4CAF50);
        const createText = this.add.text(400, 250, 'Create Room', {
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        // Make both the button and text interactive
        createButton.setInteractive({ useHandCursor: true });
        createText.setInteractive({ useHandCursor: true });

        const createRoom = () => this.createRoom();
        createButton.on('pointerdown', createRoom);
        createText.on('pointerdown', createRoom);

        this.mainContainer.add(createButton);
        this.mainContainer.add(createText);

        // Join Room section
        const joinTitle = this.add.text(400, 350, 'Join Room', {
            fontSize: '24px',
            color: '#000'
        }).setOrigin(0.5);
        this.mainContainer.add(joinTitle);

        // Create an HTML input element
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = 'Enter Room Code';
        inputElement.style.width = '200px';
        inputElement.style.height = '30px';
        inputElement.style.textAlign = 'center';
        inputElement.style.fontSize = '18px';

        // Add the input element to the game
        this.roomInput = this.add.dom(400, 400, inputElement);
        this.mainContainer.add(this.roomInput);

        // Join button
        const joinButton = this.add.rectangle(400, 450, 200, 50, 0x2196F3);
        const joinText = this.add.text(400, 450, 'Join Room', {
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        // Make both the button and text interactive
        joinButton.setInteractive({ useHandCursor: true });
        joinText.setInteractive({ useHandCursor: true });

        const joinRoom = () => {
            const roomId = this.roomInput.node.value.trim();
            if (roomId) {
                console.log('Joining room:', roomId);
                this.socket.emit('joinRoom', roomId);
            } else {
                this.showError('Please enter a room code');
            }
        };

        joinButton.on('pointerdown', joinRoom);
        joinText.on('pointerdown', joinRoom);

        this.mainContainer.add(joinButton);
        this.mainContainer.add(joinText);

        // Add hover effects
        [createButton, joinButton].forEach(button => {
            button.on('pointerover', () => {
                button.setAlpha(0.8);
            });
            button.on('pointerout', () => {
                button.setAlpha(1);
            });
        });

        // Allow Enter key to trigger join
        inputElement.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                joinRoom();
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('roomCreated', this.handleRoomCreated.bind(this));
        this.socket.on('joinedRoom', this.handleJoinedRoom.bind(this));
        this.socket.on('playerJoined', this.handlePlayerJoined.bind(this));
        this.socket.on('roomError', this.handleRoomError.bind(this));

        this.socket.on('playerReady', ({ roomId, players }) => {
            console.log('Player ready update received:', {
                roomId,
                currentRoomId: this.currentRoomId,
                players: players.map(p => ({
                    id: p.id,
                    ready: p.ready,
                    isCurrentPlayer: p.id === this.playerId
                }))
            });
            if (this.currentRoomId === roomId) {
                this.updatePlayerStatus(players);
            }
        });

        this.socket.on('gameStart', ({ roomId, players, gameState, currentTurn }) => {
            console.log('Game starting:', { roomId, players, gameState, currentTurn });
            if (this.currentRoomId === roomId) {
                this.scene.start('MainScene', { 
                    socket: this.socket,
                    roomId: this.currentRoomId,
                    playerId: this.playerId,
                    players,
                    gameState,
                    currentTurn
                });
            }
        });

        this.socket.on('playerLeft', ({ roomId, players }) => {
            if (this.currentRoomId === roomId) {
                this.showError('Other player left the game');
                // Optional: Return to main menu after delay
                this.time.delayedCall(3000, () => {
                    window.location.reload();
                });
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.showError('Connection error. Please try again.');
        });
    }

    createRoom() {
        this.socket.emit('createRoom');
    }

    showCopyableCode(roomId) {
        // Create a copyable input for the room code
        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.value = roomId;
        codeInput.readOnly = true;
        codeInput.style.width = '200px';
        codeInput.style.height = '40px';
        codeInput.style.textAlign = 'center';
        codeInput.style.fontSize = '24px';
        codeInput.style.backgroundColor = '#4CAF50';
        codeInput.style.color = 'white';
        codeInput.style.border = 'none';
        codeInput.style.borderRadius = '5px';
        codeInput.style.cursor = 'pointer';

        // Add click handler to select and copy the code
        codeInput.onclick = () => {
            codeInput.select();
            document.execCommand('copy');
            this.showMessage('Room code copied!');
        };

        const codeElement = this.add.dom(400, 150, codeInput);
        const instructionText = this.add.text(400, 200, 'Click the code to copy it!', {
            fontSize: '18px',
            color: '#666'
        }).setOrigin(0.5);

        this.waitingContainer.add([codeElement, instructionText]);
    }

    showWaitingRoom(players) {
        this.mainContainer.setVisible(false);
        this.waitingContainer.setVisible(true);
        
        // Clear existing content
        this.waitingContainer.removeAll();

        // Background for waiting room
        const bg = this.add.rectangle(0, 0, 800, 600, 0xf0f0f0).setOrigin(0);
        this.waitingContainer.add(bg);

        // Show room code section
        if (this.playerId === players[0].id) {
            const titleText = this.add.text(400, 100, `Room Code: ${this.currentRoomId}`, {
                fontSize: '24px',
                color: '#000',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.waitingContainer.add(titleText);
            this.showCopyableCode(this.currentRoomId);
        } else {
            const titleText = this.add.text(400, 100, `Room Code: ${this.currentRoomId}`, {
                fontSize: '24px',
                color: '#000',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.waitingContainer.add(titleText);
        }

        // Create player status container
        const statusContainer = this.add.container(400, 300);
        
        // Add "Players:" header
        const playersHeader = this.add.text(0, -60, 'Players:', {
            fontSize: '24px',
            color: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Create status boxes for both players
        const myStatusBox = this.add.rectangle(-100, 0, 180, 80, 0xffffff);
        const opponentStatusBox = this.add.rectangle(100, 0, 180, 80, 0xffffff);
        
        // Initialize statusText object
        this.statusText = {
            playerStatus: this.add.text(-100, 0, 'Not Ready', {
                fontSize: '20px',
                color: '#ff0000'
            }).setOrigin(0.5),
            opponentStatus: this.add.text(100, 0, 'Waiting...', {
                fontSize: '20px',
                color: '#666666'
            }).setOrigin(0.5)
        };

        // Add all elements to the status container
        statusContainer.add([
            playersHeader,
            myStatusBox,
            opponentStatusBox,
            this.statusText.playerStatus,
            this.statusText.opponentStatus
        ]);

        this.waitingContainer.add(statusContainer);

        // Add ready button below status boxes
        this.readyButton = this.add.rectangle(400, 400, 200, 50, 0x4CAF50);
        const readyText = this.add.text(400, 400, 'Ready', {
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        this.readyButton.setInteractive({ useHandCursor: true });
        readyText.setInteractive({ useHandCursor: true });

        const onReady = () => {
            this.socket.emit('playerReady', this.currentRoomId);
            this.readyButton.setFillStyle(0x666666);
            this.readyButton.disableInteractive();
            readyText.disableInteractive();
            
            // Create waiting text above the button
            const waitingText = this.add.text(400, 370, 'Waiting for opponent...', {
                fontSize: '18px',
                color: '#666666',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5);
            this.waitingContainer.add(waitingText);
            
            // Keep the ready text as is, just disable it
            readyText.setAlpha(0.6);
        };

        this.readyButton.on('pointerdown', onReady);
        readyText.on('pointerdown', onReady);

        this.waitingContainer.add([this.readyButton, readyText]);
        
        this.updatePlayerStatus(players);
    }

    updatePlayerStatus(players) {
        console.log('Updating player status:', {
            players: players.map(p => ({
                id: p.id,
                ready: p.ready,
                isCurrentPlayer: p.id === this.playerId
            })),
            hasStatusText: !!this.statusText,
            hasReadyButton: !!this.readyButton
        });
        
        if (!this.statusText) return;

        const myPlayer = players.find(p => p.id === this.playerId);
        const otherPlayer = players.find(p => p.id !== this.playerId);

        // Update player status
        if (myPlayer) {
            this.statusText.playerStatus
                .setText(myPlayer.ready ? 'Ready' : 'Not Ready')
                .setStyle({ color: myPlayer.ready ? '#00aa00' : '#ff0000' });
            
            // Update ready button state based on player's ready status
            if (this.readyButton && myPlayer.ready) {
                this.readyButton.setFillStyle(0x666666);
                this.readyButton.disableInteractive();
                // Find and update the ready text
                this.waitingContainer.list.forEach(child => {
                    if (child.type === 'Text' && child.text === 'Ready') {
                        child.disableInteractive();
                    }
                });
            }
        }

        // Update opponent status
        if (otherPlayer) {
            this.statusText.opponentStatus
                .setText(otherPlayer.ready ? 'Ready' : 'Not Ready')
                .setStyle({ color: otherPlayer.ready ? '#00aa00' : '#ff0000' });
        } else {
            this.statusText.opponentStatus
                .setText('Waiting...')
                .setStyle({ color: '#666666' });
        }
    }

    waitForPlayer() {
        this.add.text(400, 400, 'Waiting for another player...', {
            fontSize: '24px',
            color: '#666'
        }).setOrigin(0.5);
    }

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

    handleRoomCreated({ roomId, playerId }) {
        console.log('Room created:', roomId, 'Player ID:', playerId);
        this.currentRoomId = roomId;
        this.playerId = playerId;
        this.showWaitingRoom([{ id: playerId, ready: false }]);
        this.showCopyableCode(roomId);
    }

    handleJoinedRoom({ roomId, playerId, players }) {
        console.log('Joined room:', roomId, 'as player:', playerId);
        this.currentRoomId = roomId;
        this.playerId = playerId;
        this.showWaitingRoom(players);
    }

    handlePlayerJoined({ roomId, players }) {
        console.log('Player joined. Current players:', players);
        if (this.currentRoomId === roomId) {
            this.showWaitingRoom(players);
        }
    }

    handleRoomError(error) {
        console.error('Room error:', error);
        this.showError(error);
    }
} 