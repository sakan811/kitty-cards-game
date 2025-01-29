export class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.socket = null;
        this.roomInput = null;
        this.mainContainer = null;
        this.waitingContainer = null;
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
        this.socket.on('roomCreated', (roomId) => {
            this.showRoomCode(roomId);
        });

        this.socket.on('joinedRoom', (roomId) => {
            console.log('Joined room:', roomId);
            this.scene.start('MainScene', { socket: this.socket });
        });

        this.socket.on('playerJoined', (players) => {
            console.log('Player joined, total players:', players.length);
            if (players.length === 2) {
                console.log('Starting game...');
                this.scene.start('MainScene', { socket: this.socket });
            }
        });

        this.socket.on('roomError', (error) => {
            console.error('Room error:', error);
            this.showError(error);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.showError('Connection error. Please try again.');
        });
    }

    createRoom() {
        this.socket.emit('createRoom');
    }

    showRoomCode(roomId) {
        // Hide main container
        this.mainContainer.setVisible(false);
        
        // Show waiting container
        this.waitingContainer.setVisible(true);

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

        // Add the elements to the waiting container
        const titleText = this.add.text(400, 200, 'Your Room Code:', {
            fontSize: '24px',
            color: '#000'
        }).setOrigin(0.5);

        const codeElement = this.add.dom(400, 250, codeInput);

        const instructionText = this.add.text(400, 300, 'Click the code to copy it!', {
            fontSize: '18px',
            color: '#666'
        }).setOrigin(0.5);

        const waitingText = this.add.text(400, 400, 'Waiting for another player...', {
            fontSize: '24px',
            color: '#666'
        }).setOrigin(0.5);

        this.waitingContainer.add([titleText, codeElement, instructionText, waitingText]);
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
} 